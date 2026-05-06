import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import { User } from "../models/user.model.js";
import { AuthRequest } from "../types/authRequest.js";

const generateAccessToken = (user: any) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: "1h",
  });
};

const generateRefreshToken = (user: any) => {
  return jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: "7d",
  });
};

export const googleAuth = async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({
      message: "Access token is required",
    });
  }

  try {
    const userRes = await axios.get(
      "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const { email, name, picture } = userRes.data;

    if (!email) {
      return res.status(400).json({ message: "Google email not found" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: name || email.split("@")[0],
        email,
        image: picture,
        role: "user",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "User blocked" });
    }

    const newAccessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {  
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken: newAccessToken,
    });
  } catch (err: any) {
    const googleError = err.response?.data || err.message;
    console.log("Google Auth Error:", googleError);

    return res.status(400).json({
      message: "Google Auth Failed",
      error: googleError,
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No refresh token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as {
      id: string;
    };

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" },
    );

    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await User.findById(req.user.id).select("-__v");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user });
  } catch (err: any) {
    console.log("Get user error:", err.message);
    return res.status(500).json({ message: "Server Error" });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Logout Error:", err);
    return res.status(500).json({ message: "logout Something went wrong" });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().select("-password -__v");
    return res.status(200).json(users);
  } catch (err) {
    console.error("Get All Users Error:", err);
    return res.status(500).json({ message: "Server Error" });
  } finally {
    console.log("getAllusers endpoint hit");
  }
};
