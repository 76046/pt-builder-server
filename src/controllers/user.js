import User from "../schemas/user.js";
import Role from "../schemas/role.js";
import Avatar from "../schemas/avatar.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Invitation from "../schemas/invitation.js";
import mongoose from "mongoose";

export const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
    })
      .populate("roles")
      .populate("friends", { username: 1, email: 1, _id: 1 });
    if (user) return res.send(user);
    else return res.status(404).end("Not found");
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
};

export const postUser = async (req, res) => {
  try {
    const tempUsr = req.body;
    if (!tempUsr || Object.keys(tempUsr).length === 0)
      return res.status(400).end("Invalid data");
    if (tempUsr.roles) {
      tempUsr.roles = await Role.find().where("name").in(tempUsr.roles).exec();
    } else {
      tempUsr.roles = await Role.find({ name: "user" }).exec();
    }

    if (!tempUsr.password || !tempUsr.email)
      return res.status(400).end("Incomplete data");

    const salt = await bcrypt.genSalt();
    tempUsr.password = await bcrypt.hash(tempUsr.password, salt);

    const payload = {
      email: tempUsr.email,
      roles: tempUsr.roles,
    };

    const saved = await new User(tempUsr).save().catch((err) => {
      if (err && err.code === 11000) {
        return res.status(422).end("Already exists");
      }
      return res.status(422).end("Something goes wrong");
    });

    if (saved._doc) {
      let data = saved._doc;
      const SECRET = process.env.TOKEN_SECRET;
      const token = jwt.sign(payload, SECRET, {
        expiresIn: "1d",
      });
      data.roles = tempUsr.roles.map((e) => e._doc.name);
      delete data.summaries;
      delete data.password;
      delete data.friends;
      delete data.__v;
      return res.send({
        user: data,
        token,
      });
    }
  } catch (e) {
    if (e.name == "ValidationError") {
      return res.status(422).end("ValidationError");
    }
    console.error(e);
    res.status(500).end();
  }
};

export const deleteUserById = async (req, res) => {
  try {
    if (req.roles.map((e) => e.name).includes("admin")) {
      const deleteUser = await User.findByIdAndDelete(req.params.id);
      if (!deleteUser) return res.status(404).end("Not found");
      return res.status(200).end("Deleted");
    }
    return res.status(401).end("Not authorized");
  } catch (err) {
    console.error(e);
    res.status(500).end();
  }
};

export const patchUser = async (req, res) => {
  try {
    if (!Object.keys(req.body).length > 0) {
      return res.status(400).end("Invalid data");
    }

    await User.findOneAndUpdate({ email: req.email }, req.body);
    const user = await User.findOne({
      email: Object.keys(req.body).includes("email")
        ? req.body.email
        : req.email,
    })
      .populate("roles")
      .populate("friends", { username: 1, email: 1, _id: 1 });
    if (!user) return res.status(404).end("Not found");

    if (
      Object.keys(req.body).includes("email") ||
      Object.keys(req.body).includes("roles")
    ) {
      const payload = {
        email: user.email,
        roles: user.roles,
      };
      const SECRET = process.env.TOKEN_SECRET;
      const token = jwt.sign(payload, SECRET, {
        expiresIn: "1d",
      });
      if (!token) return res.status(400).end("Cannot create new token");
      return res.send({ user: user, token: token });
    }

    return res.send({ user: user });
  } catch (e) {
    if (err && err.code === 11000) {
      return res.status(422).end("Already exists");
    }
    if (e.name == "ValidationError") {
      return res.status(422).end("ValidationError");
    }
    console.error(e);
    res.status(500).end();
  }
};

export const postUserLogin = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
    })
      .populate("roles")
      .populate("friends", { username: 1, email: 1, _id: 1 });
    if (!user) res.status(401).end("Login");

    const checkPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!checkPassword) res.status(401).end("Password");

    const SECRET = process.env.TOKEN_SECRET;

    const payload = {
      email: user.email,
      roles: user.roles,
    };

    const token = jwt.sign(payload, SECRET, {
      expiresIn: "1d",
    });
    let temp = user._doc;
    temp.roles = temp.roles.map((e) => e.name);
    delete temp.summaries;
    delete temp.password;
    delete temp.__v;

    return res.send({
      user: temp,
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
};

export const postUserInvite = async (req, res) => {
  try {
    const requester = await User.findOne({
      email: req.email,
    });
    if (!requester) return res.status(404).end("Requester not found");
    const requestee = await User.findOne({
      email: req.body.receiver,
    });
    if (!requestee) return res.status(404).end("Requestee not found");
    if (requester._doc._id.toString() === requestee._doc._id.toString())
      return res.status(400).end("You are requestee");
    if (
      requester._doc.friends.includes(requestee._doc._id) &&
      requestee._doc.friends.includes(requester._doc._id)
    ) {
      return res.status(400).end("Already a friend");
    }

    const invitation = {
      requester: requester._doc._id,
      requestee: requestee._doc._id,
      status: "PENDING",
    };

    const savedInvitation = await new Invitation(invitation).save();
    res.send({
      id: savedInvitation._id,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(404).end("Invitation already exists");
    }
    console.error(err);
    res.status(500).end();
  }
};

export const getUserInvitations = async (req, res) => {
  try {
    let response = {};
    const user = await User.findOne({
      email: req.email,
    });
    const invitations = await Invitation.find({})
      .populate("requester", { username: 1, email: 1, _id: 1 })
      .populate("requestee", { username: 1, email: 1, _id: 1 });

    if (!invitations || !invitations.length > 0) {
      return res.send(response);
    }

    const requester = invitations
      .filter(
        (i) => i._doc?.requester?._doc._id.toString() === user._id.toString()
      )
      .map((i) => i._doc);

    for (let i = 0; i < requester.length; i++) {
      delete requester[i].requester;
    }

    const requestee = invitations
      .filter(
        (i) => i._doc?.requestee?._doc._id.toString() === user._id.toString()
      )
      .map((i) => i._doc);

    for (let i = 0; i < requestee.length; i++) {
      delete requestee[i].requestee;
    }

    if (requestee) response.received = requestee;
    if (requester) response.sent = requester;
    return res.send(response);
  } catch (err) {
    console.error(err);
    return res.status(500).end();
  }
};

export const getUnfriendUser = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.email,
    });
    if (!user) return res.status(404).end("User not found");
    const toUnfriend = await User.findById(req.params.id);
    if (!toUnfriend) return res.status(404).end("Friend not found");

    if (user._doc.friends.includes(toUnfriend._doc._id)) {
      const newFriends = user._doc.friends.filter(
        (id) => id != toUnfriend._doc._id
      );
      await User.findOneAndUpdate(
        { email: req.email },
        { friends: newFriends }
      );
    }
    if (toUnfriend._doc.friends.includes(user._doc._id)) {
      const newFriends2 = toUnfriend._doc.friends.filter(
        (id) => id != user._doc._id
      );
      await User.findOneAndUpdate(
        { email: toUnfriend._doc.email },
        { friends: newFriends2 }
      );
    }
    return res.status(200).end("Done");
  } catch (err) {
    console.error(err);
    return res.status(500).end();
  }
};

let gridfsbucket;

mongoose.connection.once("open", () => {
  gridfsbucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    chunkSizeBytes: 1024,
    bucketName: "files",
  });
});

export const postAvatar = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.email,
    });
    if (!user) return res.status(404).end("Not found");
    await Avatar.deleteMany({ userId: user._doc._id.toString() });
    let { file } = req.files;
    const stream = gridfsbucket.openUploadStream(file.name);

    stream.on("error", function (error) {
      console.log(error);
      return res
        .status(500)
        .end(`[*] Error while uploading new file, with error: ${error}`);
    });
    stream.on("finish", async function (uploadedFile) {
      const avatar = await new Avatar({
        userId: user._doc._id,
        filename: uploadedFile.filename,
        docId: uploadedFile._id,
      }).save();
      return res.send({
        _id: avatar._doc._id,
      });
    });

    stream.write(file.data);
    stream.end();
  } catch (err) {
    return res.status(500).end();
  }
};

export const getAvatar = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.email,
    });

    if (!user) return res.status(404).end("Not found");
    let avatar = await Avatar.findOne({ userId: user._doc._id.toString() });
    if (!avatar) {
      avatar = await Avatar.findOne({ filename: "pokeball.png" });
    }
    let filetype = avatar._doc.filename.split(".").pop();
    res.set("content-type", "image/" + filetype);
    const stream = gridfsbucket.openDownloadStream(avatar._doc.docId);
    stream.on("error", function (error) {
      console.log(error);
      return res
        .status(500)
        .end(`[*] Error while dowloading  file, with error: ${error}`);
    });
    stream.on("data", (chunk) => {
      res.write(chunk);
    });
    stream.on("end", function () {
      return res.end();
    });
  } catch (err) {
    return res.status(500).end();
  }
};

export const getAvatarById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).end("Not found");
    let avatar = await Avatar.findOne({ userId: user._doc._id.toString() });
    if (!avatar) {
      avatar = await Avatar.findOne({ filename: "pokeball.png" });
    }
    let filetype = avatar._doc.filename.split(".").pop();
    res.set("content-type", "image/" + filetype);

    const stream = gridfsbucket.openDownloadStream(avatar._doc.docId);
    stream.on("error", function (error) {
      console.log(error);
      return res
        .status(500)
        .end(`[*] Error while dowloading  file, with error: ${error}`);
    });
    stream.on("data", (chunk) => {
      res.write(chunk);
    });
    stream.on("end", function () {
      return res.end();
    });
  } catch (err) {
    console.error(err);
    return res.status(500).end();
  }
};

export const verifyToken = async (req, res) => {
  try {
    jwt.verify(req.body.token, process.env.TOKEN_SECRET);
    res.json({
      valid: true,
    });
  } catch (ex) {
    res.json({
      valid: false,
    });
  }
};
