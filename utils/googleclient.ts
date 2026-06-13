import { google } from "googleapis";

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://newmedifinddeploy-env.eba-pp6njqrd.eu-north-1.elasticbeanstalk.com/auth/google"
);
