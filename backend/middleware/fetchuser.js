var jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

const fetchuser = (req, res, next) => {
  //get the user from the auth token
  const token = req.header("auth-token");
  //console.log("token:")

  if (!token) {
    res.status(401).send({ error: "please authenticate using a valid token " });
  }
  try {
    const data = jwt.verify(token, JWT_SECRET);
    // console.log("data:")

    req.user = data.user;

    // console.log(req.user)

    next();
  } catch (error) {
    res.status(401).send({ error: "plese authenticate using a valid a user " });
  }
};
module.exports = fetchuser;
