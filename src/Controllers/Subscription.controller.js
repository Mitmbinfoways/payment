const ApiError = require("../utils/ApiError.utils");
const ApiResponse = require("../utils/ApiResponse.utils");

const getAllSubscriptionStatuses = async (req, res) => {
  try {
    console.log("Hello");
    return res.status(200).json(new ApiResponse(200, []));
  } catch (error) {
    return res.status(500).json(new ApiError(500, error.message));
  }
};

module.exports = {
  getAllSubscriptionStatuses,
};
