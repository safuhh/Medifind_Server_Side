import { Request } from "express";
import { UserType } from "../models/user.model.js";

export interface AuthRequest extends Request {
  user?: UserType & { id?: string };
}