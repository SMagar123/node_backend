import { asyncHandler } from "../utils/asyncHandler.js";
import { APIError } from "../utils/APIError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinaryFileUpload.js";
import { APIResponse } from "../utils/APIResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const refreshToken = user.generateRefreshToken();
    const accessToken = user.generateAccessToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { refreshToken, accessToken };
  } catch (error) {
    throw new APIError(
      500,
      "Something went wrong while generating refresh and access tokens!"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  //validation - not empty
  //check if user already exists : username, emails
  //check for images, check for avatar
  //upload them to cloudinary, avatar
  //create user object - create entry in db
  //remove password and refresh token field from response
  //check for user creation
  //return res

  const { fullName, email, username, password } = req.body;

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new APIError(400, "All fields are required !");
  }
  //checks the user with username or email in mongodb collection
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new APIError(409, "User with this email or username already exists!");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new APIError(400, "Avatar file is required !");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new APIError(400, "Avatar file is required !");
  }

  const user = await User.create({
    fullName,
    avatar: avatar?.url,
    coverImage: coverImage?.url || "",
    username: username.toLowerCase(),
    email,
    password,
  });

  const createdUser = await User.findById(user?._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new APIError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new APIResponse(200, createdUser, "User registered successfully !"));
});

const loginUser = asyncHandler(async (req, res) => {
  //req body -> data
  //username or email
  //find the user
  //check password
  //access amd refresh token
  //send cookie

  const { email, username, password } = req.body;
  if (!username || !email) {
    throw new APIError(400, "Username or email is required !");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new APIError(404, "User doesn't exist !");
  }

  const isPasswordValid = await user.isPasswordValid(password);
  if (!isPasswordValid) {
    throw new APIError(401, "Invalid user credentials !");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password, -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new APIResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully !"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new APIResponse(200, {}, "User logout successfully !"));
});
export { registerUser, loginUser, logoutUser };
