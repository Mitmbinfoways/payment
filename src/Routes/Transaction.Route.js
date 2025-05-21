const express = require("express");
const TransactionRoute = express.Router();
const appleClientMiddleware = require("../Middleware/AuthMiddleware.middleware");
const {
  getAllTransactionHistory,
  getTransactionInfo,
  getAllSubscriptionStatuses,
  getRefundHistory,
  sendNotification,
  getNotification,
} = require("../Controllers/Transaction.controller");

TransactionRoute.get(
  "/transactionHistory/:originalTransactionId",
  appleClientMiddleware,
  getAllTransactionHistory
);
TransactionRoute.get(
  "/transactionInfo/:transactionId",
  appleClientMiddleware,
  getTransactionInfo
);

TransactionRoute.get(
  "/SubscriptionStatuses/:transactionId",
  appleClientMiddleware,
  getAllSubscriptionStatuses
);

TransactionRoute.get(
  "/refundHistory/:transactionId",
  appleClientMiddleware,
  getRefundHistory
);

TransactionRoute.post(
  "/sendNotification",
  appleClientMiddleware,
  sendNotification
);

TransactionRoute.get(
  "/getNotification/: ",
  appleClientMiddleware,
  getNotification
);

module.exports = TransactionRoute;
