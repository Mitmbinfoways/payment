const express = require("express");
const cors = require("cors");
const path = require("path");
const SubscriptionRoute = require("./Routes/Subscription.Route");
const TransactionRoute = require("./Routes/Transaction.Route");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/v1/transaction", TransactionRoute);

module.exports = app;
