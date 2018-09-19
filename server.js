// Declarations ------------------------------
const express = require("express");
const bodyParser = require("body-parser");
const exphbs = require("express-handlebars");
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

// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";
// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI, {useNewUrlParser: true});

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

// Retrieve data from the db
app.get("/all", function (req, res) {
  // Find all results from the scrapedData collection in the db
  db.Article.find({}, function (error, found) {
    // Throw any errors to the console
    if (error) {
      console.log(error);
    }
    // If there are no errors, send the data to the browser as json
    else {
      res.json(found);
    }
  });
});

// Scrape data from one site and place it into the mongodb db
app.get("/scrape", function (req, res) {
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

      console.log(result); // for testing

      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function (dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function (err) {
          // If an error occurred, send it to the client
          return res.json(err);
        });
    });
  });

  // Send a "Scrape Complete" message to the browser
  res.send("Scrape Complete");
});

// Set the app to listen on port 3000
app.listen(PORT, function () {
  console.log("App running on port " + PORT);
});