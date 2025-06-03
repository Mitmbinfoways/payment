const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const ApiError = require("../utils/ApiError.utils");
const ApiResponse = require("../utils/ApiResponse.utils");
const {
  SignedDataVerifier,
  Environment,
} = require("@apple/app-store-server-library");
const jwt = require("jsonwebtoken");

// Apple API base URL setup
const APPLE_API_BASE_URL =
  process.env.APPLE_API_ENV === "production"
    ? "https://api.storekit.itunes.apple.com"
    : "https://api.storekit-sandbox.itunes.apple.com";

// Validate required fields
const validateParams = (params, requiredFields) => {
  for (const field of requiredFields) {
    if (
      !params?.[field] ||
      typeof params[field] !== "string" ||
      params[field].trim() === ""
    ) {
      throw new ApiError(400, `Missing or invalid ${field}`);
    }
  }
};

const DecodeJWT = (token) => {
  try {
    const base64Payload = token.split(".")[1];
    const decoded = Buffer.from(base64Payload, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Invalid JWT token:", error.message);
    return null;
  }
};

// Apple API Axios instance
const appleApiClient = axios.create({
  baseURL: APPLE_API_BASE_URL,
  timeout: 10000,
});

// Make Apple API Request
const makeAppleApiRequest = async (method, url, token, data = null) => {
  try {
    const response = await appleApiClient({
      method,
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data,
    });
    return response;
  } catch (error) {
    console.error(`Apple API error (${method} ${url}):`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw new ApiError(
      error.response?.status || 500,
      error.response?.data?.error?.message || "Apple API request failed"
    );
  }
};

// Load Apple Root CAs
const APPLE_ROOT_CA_PATHS = [
  path.resolve(__dirname, "../config/keys/certs/AppleRootCA-G3.cer"),
];

const loadRootCAs = async () => {
  try {
    const certs = await Promise.all(
      APPLE_ROOT_CA_PATHS.map(async (certPath) => {
        return await fs.readFile(certPath); // Read as buffer
      })
    );
    return certs;
  } catch (error) {
    throw new ApiError(500, `Failed to load root CAs: ${error.message}`);
  }
};

// Initialize SignedDataVerifier
const initializeVerifier = async () => {
  try {
    const appleRootCAs = await loadRootCAs();
    const enableOnlineChecks = true;
    const appAppleId = undefined;
    const environment =
      process.env.APPLE_API_ENV === "production"
        ? Environment.PRODUCTION
        : Environment.SANDBOX;

    const bundleId = process.env.APPLE_BUNDLE_ID;
    const verifier = new SignedDataVerifier(
      appleRootCAs,
      enableOnlineChecks,
      environment,
      bundleId,
      appAppleId
    );
    return verifier;
  } catch (error) {
    throw new ApiError(500, `Failed to initialize verifier: ${error.message}`);
  }
};

const getAllTransactionHistory = async (req, res) => {
  try {
    validateParams(req.params, ["originalTransactionId"]);
    if (!req.appleJwt) throw new ApiError(401, "Missing Apple JWT");

    const response = await makeAppleApiRequest(
      "get",
      `/inApps/v1/history/${req.params.originalTransactionId}`,
      req.appleJwt
    );

    const { signedTransactions } = response.data;

    const verifier = await initializeVerifier();

    const decodedTransactions = await Promise.all(
      signedTransactions.map(async (signedTransaction) => {
        try {
          return await verifier.verifyAndDecodeTransaction(signedTransaction);
        } catch (error) {
          console.error(`Failed to decode transaction: ${error.message}`);
          return null;
        }
      })
    );

    const validDecodedTransactions = decodedTransactions.filter(Boolean);

    res.json(
      new ApiResponse(
        200,
        validDecodedTransactions,
        "Transaction history fetched and verified successfully"
      )
    );
  } catch (error) {
    res
      .status(error.status || 500)
      .json(
        new ApiError(
          error.status || 500,
          error.message || "Internal Server Error"
        )
      );
  }
};

const getTransactionInfo = async (req, res) => {
  try {
    validateParams(req.params, ["transactionId"]);
    if (!req.appleJwt) throw new ApiError(401, "Missing Apple JWT");

    // Step 1: Call Apple API to get transaction info
    const response = await makeAppleApiRequest(
      "get",
      `/inApps/v1/transactions/${req.params.transactionId}`,
      req.appleJwt
    );

    const { signedTransactionInfo, environment, bundleId } = response.data;

    if (!signedTransactionInfo) {
      throw new ApiError(404, "No signed transaction info found");
    }

    // Step 2: Initialize the verifier
    const verifier = await initializeVerifier(environment, bundleId);

    // Step 3: Decode the signed transaction
    let decodedTransaction;
    try {
      decodedTransaction = await verifier.verifyAndDecodeTransaction(
        signedTransactionInfo
      );
    } catch (err) {
      throw new ApiError(400, `Failed to decode transaction: ${err.message}`);
    }

    // Step 4: Respond with the decoded transaction
    res.json(
      new ApiResponse(
        200,
        decodedTransaction,
        "Transaction info fetched and verified successfully"
      )
    );
  } catch (error) {
    res
      .status(error.status || 500)
      .json(
        new ApiError(
          error.status || 500,
          error.message || "Internal Server Error"
        )
      );
  }
};

const getAllSubscriptionStatuses = async (req, res) => {
  try {
    validateParams(req.params, ["transactionId"]);
    if (!req.appleJwt) throw new ApiError(401, "Missing Apple JWT");

    console.log(req.appleJwt);
    console.log(req.params.transactionId);
    try {
      const response = await makeAppleApiRequest(
        "get",
        `/inApps/v1/subscriptions/${req.params.transactionId}`,
        req.appleJwt
      );
      console.log(response.data);
      const data =
        response.data.data[0]?.lastTransactions[0]?.signedRenewalInfo;
      const decodedData = DecodeJWT(data);

      console.log(decodedData);
      res.json(
        new ApiResponse(
          200,
          decodedData,
          "Subscription statuses fetched successfully"
        )
      );
    } catch (error) {
      console.log(error);
    }
  } catch (error) {
    console.log(error);
    res.status(error.status || 500).json(error.message);
  }
};

const getRefundHistory = async (req, res) => {
  try {
    // Validate required parameter
    validateParams(req.params, ["transactionId"]);

    // Check if Apple JWT is present
    if (!req.appleJwt) {
      return res.status(401).json(new ApiError(401, "Missing Apple JWT"));
    }

    // Make the Apple API request
    const response = await makeAppleApiRequest(
      "get",
      `/inApps/v2/refund/lookup/${req.params.transactionId}`,
      req.appleJwt
    );

    // Return successful response
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          response.data,
          "Refund history fetched successfully"
        )
      );
  } catch (error) {
    console.error("Refund History Error:", error);

    // Handle structured error or fallback
    const status = error?.statusCode || error?.status || 500;
    const message =
      error?.errorData ||
      error?.message ||
      "Something went wrong while fetching refund history";

    return res.status(status).json(new ApiError(status, message));
  }
};

const sendNotification = async (req, res) => {
  // try {
  //   if (!req.appleJwt) {
  //     throw new ApiError(401, "Missing Apple JWT");
  //   }

  //   const response = await makeAppleApiRequest(
  //     "post",
  //     "/inApps/v1/notifications/test",
  //     req.appleJwt,
  //     {}
  //   );

  //   res.json(
  //     new ApiResponse(200, response.data, "Test notification sent successfully")
  //   );
  // } catch (error) {
  //   res.status(error.status || 500).json({
  //     statusCode: error.status || 500,
  //     errorData: error?.message || "Failed to send test notification",
  //   });
  // }

  try {
    console.log("Apple test notification received:", req.body);
    res.sendStatus(200); // Apple expects 200 OK
  } catch (error) {
    console.error("Error handling notification:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getNotification = async (req, res) => {
  try {
    // Validate required parameter
    validateParams(req.params, ["testNotificationToken"]);

    // Check for Apple JWT
    if (!req.appleJwt) {
      throw new ApiError(401, "Missing Apple JWT");
    }

    // Make Apple API request to get the test notification by token
    const response = await makeAppleApiRequest(
      "get",
      `/inApps/v1/notifications/test/${req.params.testNotificationToken}`,
      req.appleJwt
    );

    // Respond with API data
    res.json(
      new ApiResponse(
        200,
        response.data,
        "Test notification fetched successfully"
      )
    );
  } catch (error) {
    console.error(
      "Apple Get Notification Error:",
      error?.response?.data || error.message
    );

    res.status(error.status || 500).json({
      statusCode: error.status || 500,
      errorData: error?.message || "Failed to fetch test notification",
    });
  }
};

module.exports = {
  getAllTransactionHistory,
  getTransactionInfo,
  getAllSubscriptionStatuses,
  getRefundHistory,
  sendNotification,
  getNotification,
};
