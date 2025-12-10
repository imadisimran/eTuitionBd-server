const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin-sdk.json");
const port = process.env.PORT || 3000;

//Middleware
app.use(express.json());
app.use(cors());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFBToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log(authorization)
  if (!authorization) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  // console.log(token)
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // console.log(decoded);
    req.decoded_email = decoded.email;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

const verifyEmail = (req, res, next) => {
  const decoded_email = req.decoded_email;
  const request_email = req.query.email;
  if (decoded_email !== request_email) {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

verifyAdmin = async (req, res, next) => {
  const query = {};
  query.email = req.decoded_email;
  const userRole = await usersCollection.findOne(query, {
    projection: { role: 1 },
  });
  if (userRole.role === "admin") {
    next();
  } else {
    return res.status(403).send({ message: "Unauthorized access" });
  }
};

//functions
const checkProfile = (user) => {
  // 1. Safety Check: Return immediately if no user provided
  if (!user)
    return {
      percent: 0,
      isReady: false,
      missingItems: ["User profile not found"],
    };

  let score = 2;
  let totalPoints = 2;
  let missing = [];

  // Helper function to keep code DRY (Don't Repeat Yourself)
  const checkField = (value, label) => {
    totalPoints++;
    // Check if value exists and is not an empty string
    if (value) {
      score++;
    } else {
      missing.push(label);
    }
  };

  checkField(user.phone, "Phone Number");

  // Tutor
  if (user.role === "tutor") {
    const tutorProfileChecks = [
      { key: "institution", label: "Institution" },
      { key: "qualification", label: "Qualification" },
      { key: "experience", label: "Experience" },
      { key: "gender", label: "Gender" },
      { key: "bio", label: "Bio" },
    ];

    tutorProfileChecks.forEach((item) => {
      const value = user?.tutorProfile?.[item.key];
      checkField(value, item.label);
    });

    checkField(user?.tutorProfile?.subjects?.length, "Subjects");
    checkField(user?.tutorProfile?.education?.length, "Education");
  }
  // Student
  else if (user.role === "student") {
    const studentChecks = [
      { key: "class", label: "Class" },
      { key: "division", label: "Division" },
      { key: "district", label: "District" },
      { key: "address", label: "Address" },
    ];

    studentChecks.forEach((item) => {
      const value = user.studentInfo?.[item.key];
      checkField(value, item.label);
    });

    const guardianChecks = [
      { key: "relation", label: "Guardian Relation" },
      { key: "phone", label: "Guardian Phone Number" },
    ];

    guardianChecks.forEach((item) => {
      const value = user.studentInfo?.guardian?.[item.key];
      checkField(value, item.label);
    });
  }

  // Calculate Percentage
  const percentage = totalPoints === 0 ? 0 : (score / totalPoints) * 100;

  return {
    percent: Math.round(percentage),
    isReady: percentage === 100,
    missingItems: missing,
  };
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xc8a26e.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//Collections
const db = client.db("eTuitionBD");
const usersCollection = db.collection("users");
const tuitionsCollection = db.collection("tuitions");

app.get("/", (req, res) => {
  res.send({ message: "eTuitionBD backend is working" });
});

//User apis
app.post("/user", async (req, res) => {
  const data = req.body;
  // console.log(data)
  if (data?.email) {
    const isUserExist = await usersCollection.findOne(
      { email: data.email },
      { projection: { _id: 1 } }
    );
    if (isUserExist) {
      return res.send(isUserExist);
    }
  }
  const userData = {
    displayName: data.displayName,
    photoURL: data.photoURL,
    email: data.email,
    createdAt: new Date(),
  };

  if (data?.role === "tutor" && data?.institution) {
    userData.role = "tutor";
  } else {
    userData.role = "student";
  }

  // console.log(req.headers.authorization)
  const result = await usersCollection.insertOne(userData);
  // console.log(result)
  res.send(result);
});

app.get("/user", verifyFBToken, async (req, res) => {
  const query = {};
  const { email, role } = req.query;
  if (email) {
    query.email = email;
  }
  const user = await usersCollection.findOne(query);
  if (user?.role !== "admin") {
    const profileStatus = checkProfile(user);
    user.profileStatus = profileStatus;
  }
  res.send(user);
});

app.patch("/user", verifyFBToken, verifyEmail, async (req, res) => {
  const { email } = req.query;
  const query = {};
  if (email) {
    query.email = email;
  }
  const {
    photoURL,
    deleteURL,
    icon,
    phone,
    studentClass,
    division,
    district,
    guardianRelation,
    guardianPhone,
    address,
    tutorProfile,
  } = req.body;

  //updating profile picture

  if (photoURL) {
    const update = {
      $set: {
        photoURL: photoURL,
        icon: icon,
        deleteURL: deleteURL,
      },
    };

    const updateRes = await usersCollection.updateOne(query, update);
    return res.send(updateRes);
  }

  //Updating tutors info

  if (tutorProfile) {
    const {
      institution,
      qualification,
      experience,
      gender,
      bio,
      subjects,
      education,
    } = tutorProfile;
    const update = {
      $set: {
        phone: phone,
        tutorProfile: {
          institution: institution,
          qualification: qualification,
          experience: experience,
          gender: gender,
          bio: bio,
          subjects: subjects,
          education: education,
        },
      },
    };

    const updateRes = await usersCollection.updateOne(query, update);
    return res.send(updateRes);
  }

  //Updating students info

  const update = {
    $set: {
      phone: phone,
      studentInfo: {
        class: studentClass,
        division: division,
        district: district,
        address: address,
        guardian: {
          relation: guardianRelation,
          phone: guardianPhone,
        },
      },
    },
  };

  const updateRes = await usersCollection.updateOne(query, update);
  res.send(updateRes);
});

//get role

app.get("/user/role", verifyFBToken, async (req, res) => {
  const query = {};
  const { email } = req.query;
  if (email) {
    query.email = email;
  }
  const roleInfo = await usersCollection.findOne(query, {
    projection: { role: 1 },
  });
  // console.log(role)
  res.send(roleInfo);
});

//Tuition

app.post("/tuitions", verifyFBToken, verifyEmail, async (req, res) => {
  const { email } = req.query;
  const query = {};
  query.email = email;
  // if (email) {
  //   query.email = email;
  // } else {
  //   res.status(404).send({ message: "Not found" });
  // }

  const userData = await usersCollection.findOne(query);

  const profileStatus = checkProfile(userData);
  if (!profileStatus.isReady) {
    return res.status(400).send({ message: "Profile is not completed" });
  }

  const {
    title,
    subject,
    medium,
    salaryMin,
    salaryMax,
    teacherGender,
    mode,
    daysPerWeek,
    description,
  } = req.body;
  const tuitionDetails = {
    studentEmail: userData.email,
    studentName: userData.displayName,
    title: title,
    subject: subject,
    medium: medium,
    salaryRange: {
      min: Number(salaryMin),
      max: Number(salaryMax),
    },
    teacherGender: teacherGender,
    mode: mode,
    daysPerWeek: Number(daysPerWeek),
    description: description,
    status: "pending",
    location: {
      district: userData.studentInfo.district,
      division: userData.studentInfo.division,
      address: userData.studentInfo.address,
    },
    class: userData.studentInfo.class,
    createdAt: new Date(),
  };

  // console.log(tuitionDetails);

  const result = await tuitionsCollection.insertOne(tuitionDetails);

  res.send(result);
});

app.get("/tuitions", async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status !== "approved") {
    query.status = "approved";
  }
  const cursor = tuitionsCollection
    .find(query)
    .project({
      salaryRange: 1,
      subject: 1,
      createdAt: 1,
      status: 1,
      daysPerWeek: 1,
      class: 1,
      medium: 1,
      location: 1,
      title: 1,
    })
    .sort({ createdAt: -1 });
  const tuitions = await cursor.toArray();
  res.send(tuitions);
});

app.get("/my-tuitions", verifyFBToken, verifyEmail, async (req, res) => {
  const query = {};
  const { email } = req.query;
  if (email) {
    query.email = email;
  }
  const cursor = tuitionsCollection
    .find(query)
    .project({
      salaryRange: 1,
      subject: 1,
      createdAt: 1,
      status: 1,
      daysPerWeek: 1,
    })
    .sort({ createdAt: -1 });
  const tuitions = await cursor.toArray();
  res.send(tuitions);
});

app.get("/tuitions/admin", verifyFBToken, verifyAdmin, async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status) {
    query.status = status;
  }
  const cursor = tuitionsCollection
    .find(query)
    .sort({ createdAt: -1 })
    .project({ subject: 1, daysPerWeek: 1, salaryRange: 1, status: 1 });
  const posts = await cursor.toArray();
  res.send(posts);
});

app.get("/tuition/:id", async (req, res) => {
  const { id } = req.params;
  const query = {};
  if (id) {
    query._id = new ObjectId(id);
  }
  const tuitionDetails = await tuitionsCollection.findOne(query);
  res.send(tuitionDetails);
});

app.patch("/tuition/admin/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;
  // console.log(status)
  const query = {};
  if (id.length !== 24) {
    return res.status(400).send({ message: "Invalid Id" });
  }

  query._id = new ObjectId(id);
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).send({ message: "Invalid Status" });
  }

  const update = {
    $set: {
      status: status,
    },
  };

  const result = await tuitionsCollection.updateOne(query, update);
  res.send(result);
});

app.delete("/tuition/:id", verifyFBToken, verifyEmail, async (req, res) => {
  const { id } = req.params;
  const query = {};
  if (id) {
    query._id = new ObjectId(id);
  } else {
    return res.send({ message: "Id is missing" });
  }
  const result = await tuitionsCollection.deleteOne(query);
  res.send(result);
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
