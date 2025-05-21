const express = require("express");
const SubscriptionRoute = express.Router();
const appleClientMiddleware = require("../Middleware/AuthMiddleware.middleware");

SubscriptionRoute.get("/", appleClientMiddleware);

module.exports = SubscriptionRoute;
