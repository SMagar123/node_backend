import { User } from "../models/user.model";
import { APIError } from "../utils/APIError";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookie?.accessToken ||
      req.headers("Authorization")?.replace("Bearer", "");

    if (!token) {
      throw new APIError(401, "Unauthorixed request !!");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );
    if (!user) {
      throw new APIError(401, "Invalid access token !");
    }
    req.user = user;
    next();
  } catch (error) {
    throw new APIError(401, error?.nessage, "Invalid Access Token !");
  }
});
