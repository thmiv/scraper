// Declarations ------------------------------
const express = require("express");
const bodyParser = require("body-parser");
const exphbs = require("express-handlebars");
const fs = require('fs');
// Require request and cheerio. This makes the scraping possible
const request = require("request");
const cheerio = require("cheerio");
// Mongoose package for manipulating DB
const mongoose = require("mongoose");
// not sure about this
const logger = require("morgan");
// ExpressJS initialization
const app = express();
const PORT = process.env.PORT || 3000;

// If deployed, use the deployed database. Otherwise use the local mongo database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoArticles";
// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true
});

// Require all models (database schemes)
var db = require("./models");

// Middleware ----------------------------
// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({
  extended: true
}));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// Handlebars -----------------------
app.engine(
  "handlebars",
  exphbs({
    defaultLayout: "main"
  })
);
app.set("view engine", "handlebars");

// Routes --------------------------
app.get("/", function (req, res) {
  res.render("index");
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for updating an Article's associated Note
app.put("/articles/:id", function(req, res) {
  db.Note.create(req.body)
    .then(function(dbNote) {
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { $push: { note: dbNote._id } }, { new: true });
    })
    .then(function(dbArticle) {
      res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    })
});

// Route for saving article
app.put("/save/:id", function(req, res) {
  db.Article.findOneAndUpdate({ _id: req.params.id }, { saved: true }, { new: true });
});

// Scrape data from one site and place it into the mongodb db
app.get("/scrape", function (req, res) {
  fs.writeFile("log.txt", "", function(err) {
    if(err) {  return console.log(err); } });
  // Make a request for the news section of `Financial Times`
  request("https://www.ft.com/world", function (error, response, html) {
    // Load the html body from request into cheerio
    var $ = cheerio.load(html);
    // For each a element with a relevant class
    $(".o-teaser__content").each(function (i, element) {
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this)
        .children(".o-teaser__heading")
        .text().trim();
      result.link = "https://www.ft.com" + $(this)
        .children(".o-teaser__heading")
        .children("a")
        .attr("href");
      result.summary = $(this)
        .children(".o-teaser__standfirst")
        .text().trim();

      //console.log(result); // for testing

      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function (dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function (err) {
          // If an error occurred, send it to the client
          fs.appendFile("log.txt", err + "\n", function(err) {
            if(err) { return console.log(err); }
            console.log("The error was logged.");
          }); 
          //return res.json(err);
        });
    });
  });

  // Send a "Scrape Complete" message to the browser
  res.send("Scrape Complete");
});

// Clear data from the db
app.get("/api/clear", function (req, res) {
  db.Article.deleteMany({}, function (err) {
    if (err) { console.log(err); }
    else { console.log('collection removed') }
  });
});

// Route for getting saved Articles from the db
app.get("/saved", function(req, res) {
  res.render("saved");
});

// Set the app to listen on port 3000
app.listen(PORT, function () {
  console.log("App running on port " + PORT);
});
