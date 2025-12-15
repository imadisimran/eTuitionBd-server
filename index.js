const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin-sdk.json");
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.STRIPE_API_KEY);

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
  const user = await usersCollection.findOne(query, {
    projection: { role: 1 },
  });
  if (user?.role === "admin") {
    next();
  } else {
    return res.status(403).send({ message: "Unauthorized access" });
  }
};

verifyStudent = async (req, res, next) => {
  const query = {};
  query.email = req.decoded_email;
  const user = await usersCollection.findOne(query, {
    projection: { role: 1 },
  });
  if (user?.role === "student") {
    next();
  } else {
    return res.status(403).send({ message: "Unauthorized access" });
  }
};

const verifyTutor = async (req, res, next) => {
  const query = {};
  query.email = req.decoded_email;
  const user = await usersCollection.findOne(query, {
    projection: { role: 1 },
  });
  if (user?.role === "tutor") {
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
const applicationsCollection = db.collection("applications");
const paymentsCollection = db.collection("payments");

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
    userData.tutorProfile = {
      institution: data.institution,
      status: "pending",
    };
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
  const { email } = req.query;
  if (email) {
    query.email = email;
  } else {
    return res.status(400).send({ message: "User Not found" });
  }

  if (req.decoded_email !== email) {
    const decodedUser = await usersCollection.findOne(
      { email: req.decoded_email },
      { projection: { role: 1 } }
    );
    if (decodedUser.role !== "admin") {
      return res.status(403).send({ message: "Forbidden Access" });
    }
  }

  const user = await usersCollection.findOne(query);
  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }
  if (user?.role !== "admin") {
    const profileStatus = checkProfile(user);
    user.profileStatus = profileStatus;
  }
  res.send(user);
});

app.patch("/user", verifyFBToken, async (req, res) => {
  const { email } = req.query;
  const requesterEmail = req.decoded_email;

  if (!email) {
    return res.status(400).send({ message: "User not found (Email required)" });
  }

  if (requesterEmail !== email) {
    const requester = await usersCollection.findOne(
      { email: requesterEmail },
      { projection: { role: 1 } }
    );

    if (!requester || requester.role !== "admin") {
      return res.status(403).send({ message: "Forbidden Access" });
    }
  }

  const updateFields = {};
  const data = req.body;

  if (data.photoURL) {
    updateFields.photoURL = data.photoURL;
    updateFields.icon = data.icon;
    updateFields.deleteURL = data.deleteURL;
  }

  if (data.tutorProfile) {
    updateFields.phone = data.phone;

    updateFields.tutorProfile = {
      institution: data.tutorProfile.institution,
      qualification: data.tutorProfile.qualification,
      experience: Number(data.tutorProfile.experience),
      gender: data.tutorProfile.gender,
      bio: data.tutorProfile.bio,
      subjects: data.tutorProfile.subjects,
      education: data.tutorProfile.education,
    };
  }

  if (data.studentClass || data.division) {
    updateFields.phone = data.phone;
    updateFields.studentInfo = {
      class: data.studentClass,
      division: data.division,
      district: data.district,
      address: data.address,
      guardian: {
        relation: data.guardianRelation,
        phone: data.guardianPhone,
      },
    };
  }

  if (Object.keys(updateFields).length === 0) {
    return res
      .status(400)
      .send({ message: "No valid fields provided for update" });
  }

  try {
    const updateRes = await usersCollection.updateOne(
      { email: email },
      { $set: updateFields }
    );
    res.send(updateRes);
  } catch (error) {
    res.status(500).send({ message: "Failed to update user", error });
  }
});

app.get("/users", verifyFBToken, verifyAdmin, async (req, res) => {
  const cursor = usersCollection.find();
  const users = await cursor.toArray();
  users.forEach((user) => {
    if (user?.role !== "admin") {
      const profileStatus = checkProfile(user);
      user.profileStatus = {
        percent: profileStatus.percent,
        isReady: profileStatus.isReady,
      };
    }
  });
  const result = users.map((user) => {
    return {
      displayName: user?.displayName,
      email: user?.email,
      role: user?.role,
      createdAt: user?.createdAt,
      photoURL: user?.photoURL,
      percent: user?.profileStatus?.percent,
      _id: user._id,
    };
  });
  // console.log(users);
  res.send(result);
});

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

app.patch("/user-tutor", verifyFBToken, verifyEmail, async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).send({ message: "Bad request" });
  }
  const query = { email: email };
  const updateRes = await usersCollection.updateOne(query, {
    $set: { role: "tutor" },
  });
  res.send(updateRes);
});

//Tuition

app.post("/tuitions", verifyFBToken, verifyEmail, async (req, res) => {
  const { email } = req.query;
  const query = {};
  query.email = email;

  const userData = await usersCollection.findOne(query);

  if (userData.role !== "student") {
    return res.status(400).send({ message: "only student can post" });
  }

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
  const query = {};
  query.status = "approved";
  // console.log(req.query)
  const {
    searchTxt,
    sortBy,
    studentClass,
    division,
    district,
    subject,
    pageNo = 1,
  } = req.query;

  if (searchTxt) {
    query.$or = [
      { title: { $regex: searchTxt, $options: "i" } },
      { "location.address": { $regex: searchTxt, $options: "i" } },
    ];
  }

  if (studentClass) {
    query.class = studentClass;
  }

  if (division) {
    query["location.division"] = division;
  }

  if (district) {
    query["location.district"] = district;
  }

  if (subject) {
    query.subject = subject;
  }

  const skip = (pageNo - 1) * 6;

  // console.log(query);
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
    .sort(
      sortBy === "post_date" ? { createdAt: -1 } : { "salaryRange.max": -1 }
    )
    .skip(skip)
    .limit(6);
  const totalTuitions = await tuitionsCollection.countDocuments(query);
  // console.log(totalTuitions)
  const tuitions = await cursor.toArray();
  res.send({ tuitions, totalTuitions });
});

app.get("/my-tuitions", verifyFBToken, verifyEmail, async (req, res) => {
  const query = {};
  const { email, status } = req.query;
  if (status) {
    query.status = status;
  } else {
    query.status = { $nin: ["booked"] };
  }
  if (email) {
    query.studentEmail = email;
  }
  const cursor = tuitionsCollection
    .find(query)
    .project({
      salaryRange: 1,
      subject: 1,
      createdAt: 1,
      status: 1,
      daysPerWeek: 1,
      paidAt: 1,
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

//This is the best practice should be followed in all the apis

app.patch("/tuition/:id", verifyFBToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid Id" });
    }

    const user = await usersCollection.findOne(
      { email: req.decoded_email },
      { projection: { role: 1 } }
    );

    if (!user) {
      return res.status(401).send({ message: "User not found" });
    }

    if (user.role !== "admin" && user.role !== "student") {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const query = { _id: new ObjectId(id) };
    const tuition = await tuitionsCollection.findOne(query, {
      projection: { studentEmail: 1 },
    });

    if (!tuition) {
      return res.status(404).send({ message: "Tuition not found" });
    }

    if (user.role !== "admin" && tuition.studentEmail !== req.decoded_email) {
      return res.status(403).send({ message: "Forbidden Access" });
    }

    const data = req.body;

    // console.log(data);

    const update = {
      $set: {
        title: data.title,
        subject: data.subject,
        class: data.class,
        medium: data.medium,
        salaryRange: {
          min: Number(data.salaryRange.min),
          max: Number(data.salaryRange.max),
        },
        teacherGender: data.teacherGender,
        mode: data.mode,
        daysPerWeek: Number(data.daysPerWeek),
        description: data.description,
      },
    };

    // console.log(update);

    const result = await tuitionsCollection.updateOne(query, update);
    // console.log(result);
    res.send(result);
  } catch (error) {
    console.error("Error in patch tuition:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.patch(
  "/tuition/admin/:id",
  verifyFBToken,
  verifyAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.query;
    // console.log(status)
    const query = {};
    if (!ObjectId.isValid(id)) {
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
  }
);

app.get("/admin/tutor", verifyFBToken, verifyAdmin, async (req, res) => {
  const { status } = req.query;
  const query = { role: "tutor" };
  if (status === "pending") {
    query["tutorProfile.status"] = { $in: ["pending", null] };
  }

  const cursor = usersCollection.find(query);
  const tutors = await cursor.toArray();

  const completedProfiles = tutors.filter((r) => checkProfile(r).isReady);
  const result = completedProfiles.map((c) => {
    return {
      _id: c._id,
      displayName: c.displayName,
      tutorProfile: {
        institution: c.tutorProfile.institution,
        experience: c.tutorProfile.experience,
        gender: c.tutorProfile.gender,
      },
    };
  });
  res.send(result);
});

app.get("/tutor/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Bad request" });
  }
  const query = { _id: new ObjectId(id) };
  const tutor = await usersCollection.findOne(query);
  res.send(tutor);
});

app.patch("/tutor/:id", verifyFBToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Bad request" });
  }
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).send({ message: "Bad request" });
  }
  const filter = { _id: new ObjectId(id) };
  const update = {
    $set: {
      "tutorProfile.status": status,
    },
  };
  const result = await usersCollection.updateOne(filter, update);
  res.send(result);
});

app.delete("/tuition/:id", verifyFBToken, async (req, res) => {
  const { id } = req.params;
  const query = {};
  if (!id) {
    return res.status(400).send({ message: "Id is missing" });
  }
  query._id = new ObjectId(id);

  const tuitionPost = await tuitionsCollection.findOne(query, {
    projection: { studentEmail: 1 },
  });
  if (tuitionPost?.studentEmail !== req.decoded_email) {
    const user = await usersCollection.findOne(
      { email: req.decoded_email },
      { projection: { role: 1 } }
    );
    if (user?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden access" });
    }
  }
  const result = await tuitionsCollection.deleteOne(query);
  res.send(result);
});

app.get("/tutors", async (req, res) => {
  const query = { "tutorProfile.status": "approved", role: "tutor" };
  const { limit } = req.query;
  const cursor = usersCollection
    .find(query)
    .limit(Number(limit) ? Number(limit) : 0)
    .project({
      displayName: 1,
      photoURL: 1,
      "tutorProfile.institution": 1,
      "tutorProfile.experience": 1,
      "tutorProfile.qualification": 1,
    });

  const result = await cursor.toArray();
  res.send(result);
});

//Application apis

app.post("/application/:tuitionId", verifyFBToken, async (req, res) => {
  const user = await usersCollection.findOne({ email: req.decoded_email });
  if (user.role !== "tutor") {
    return res.status(403).send({ message: "Forbidden Access" });
  }
  const { isReady } = checkProfile(user);
  if (!isReady) {
    return res.status(400).send({ message: "Bad request" });
  }
  const { tuitionId } = req.params;
  const { expectedSalary, note, tuitionTitle } = req.body;

  if (!ObjectId.isValid(tuitionId)) {
    return res.status(400).send({ message: "Invalid Id" });
  }

  const { studentEmail } = await tuitionsCollection.findOne(
    { _id: new ObjectId(tuitionId) },
    { projection: { studentEmail: 1 } }
  );
  const applicationData = {
    tuitionId: tuitionId,
    tuitionTitle: tuitionTitle,
    tutorId: user._id.toString(),
    studentEmail: studentEmail,
    tutorEmail: req.decoded_email,
    tutorName: user.displayName,
    tutorImage: user.photoURL,
    appliedAt: new Date(),
    expectedSalary: Number(expectedSalary),
    note: note,
    tutorInstitution: user.tutorProfile.institution,
    experience: Number(user.tutorProfile.experience),
    tutorGender: user.tutorProfile.gender,
    status: "pending",
  };
  const result = await applicationsCollection.insertOne(applicationData);
  // console.log(applicationData);
  res.send(result);
});

app.get("/applications", verifyFBToken, async (req, res) => {
  const { email, status } = req.query;
  const query = { tutorEmail: email };
  if (status) {
    query.status = status;
  } else {
    query.status = { $nin: ["accepted"] };
  }
  const cursor = applicationsCollection
    .find(query)
    .sort({ appliedAt: -1 })
    .project({
      expectedSalary: 1,
      tuitionTitle: 1,
      note: 1,
      tuitionId: 1,
      tutorId: 1,
      status: 1,
    });
  const applications = await cursor.toArray();
  res.send(applications);
});

app.get(
  "/application/check",
  verifyFBToken,
  verifyEmail,
  verifyTutor,
  async (req, res) => {
    const { tuitionId, email } = req.query;

    const query = { tuitionId: tuitionId, tutorEmail: email };
    const result = await applicationsCollection.findOne(query, {
      projection: { _id: 1 },
    });
    res.send(result);
  }
);

app.get("/application/:applicationId", verifyFBToken, async (req, res) => {
  const { applicationId } = req.params;
  if (!ObjectId.isValid(applicationId)) {
    return res.status(400).send({ message: "Bad request" });
  }
  const query = { _id: new ObjectId(applicationId) };
  const application = await applicationsCollection.findOne(query, {
    projection: { expectedSalary: 1, tuitionTitle: 1, note: 1, tutorId: 1 },
  });
  res.send(application);
});

app.patch(
  "/application/:applicationId",
  verifyFBToken,
  verifyTutor,
  async (req, res) => {
    const { applicationId } = req.params;
    const { expectedSalary, note } = req.body;
    const query = { _id: new ObjectId(applicationId) };
    const update = {
      $set: {
        expectedSalary: expectedSalary,
        note: note,
      },
    };
    const updateRes = await applicationsCollection.updateOne(query, update);
    res.send(updateRes);
  }
);

app.delete(
  "/application/:applicationId",
  verifyFBToken,
  verifyTutor,
  async (req, res) => {
    const { applicationId } = req.params;
    const query = { _id: new ObjectId(applicationId) };
    const deleteRes = await applicationsCollection.deleteOne(query);
    res.send(deleteRes);
  }
);

app.get("/applications/tuition/:tuitionId", verifyFBToken, async (req, res) => {
  const { tuitionId } = req.params;
  const query = { tuitionId: tuitionId };
  const cursor = applicationsCollection.find(query).project({
    tutorImage: 1,
    tutorName: 1,
    tutorInstitution: 1,
    expectedSalary: 1,
    experience: 1,
    note: 1,
    tutorId: 1,
    tuitionTitle: 1,
  });

  const applications = await cursor.toArray();
  res.send(applications);
});

//Payment system

app.post("/create-checkout-session", verifyFBToken, async (req, res) => {
  const { applicationId } = req.body;
  if (!ObjectId.isValid(applicationId)) {
    return res.status(400).send({ message: "Invalid Id" });
  }
  const applicationData = await applicationsCollection.findOne({
    _id: new ObjectId(applicationId),
  });
  if (!applicationData) {
    return res.status(400).send({ message: "Invalid Id" });
  }
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "bdt",
          product_data: {
            name: applicationData.tuitionTitle,
            description: `You are going to pay ${applicationData.expectedSalary} BDT to ${applicationData.tutorName} for ${applicationData.tuitionTitle}`,
          },
          unit_amount: Number(applicationData.expectedSalary) * 100,
        },
        quantity: 1,
      },
    ],
    metadata: {
      applicationId: applicationData._id.toString(),
      tuitionId: applicationData.tuitionId,
      studentEmail: applicationData.studentEmail,
      tutorEmail: applicationData.tutorEmail,
    },
    customer_email: req.decoded_email,
    mode: "payment",
    success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
  });
  res.send({ url: session.url });
});

app.patch("/payment-success", verifyFBToken, async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) {
    return res.status(400).send({ message: "Bad request" });
  }
  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status !== "paid") {
    return res.status(400).send({ message: "Payment failed" });
  }

  const isExist = await paymentsCollection.findOne({
    transactionId: session.payment_intent,
  });
  if (isExist) {
    return res.send({ ...isExist, message: "Already Exist" });
  }

  await tuitionsCollection.updateOne(
    { _id: new ObjectId(session.metadata.tuitionId) },
    { $set: { status: "booked", paidAt: session.created } }
  );

  await applicationsCollection.updateMany(
    { tuitionId: session.metadata.tuitionId },
    { $set: { status: "rejected" } }
  );

  await applicationsCollection.updateOne(
    { _id: new ObjectId(session.metadata.applicationId) },
    { $set: { status: "accepted" } }
  );

  const paymentData = {
    transactionId: session.payment_intent,
    ...session.metadata,
    amount: session.amount_total / 100,
    paidAt: session.created,
  };

  const payment = await paymentsCollection.insertOne(paymentData);
  res.send({ ...payment, transactionId: session.payment_intent });
  // console.log(session)
});

app.get("/payments", verifyFBToken, async (req, res) => {
  const userData = await usersCollection.findOne(
    { email: req.decoded_email },
    { projection: { role: 1 } }
  );
  const query = {};
  if (userData.role === "tutor") {
    query.tutorEmail = req.decoded_email;
  } else if (userData.role === "student") {
    query.studentEmail = req.decoded_email;
  }
  const payments = await paymentsCollection
    .find(query)
    .project({
      transactionId: 1,
      amount: 1,
      paidAt: 1,
      tutorEmail: 1,
      studentEmail: 1,
    })
    .toArray();
  res.send(payments);
});

app.get("/admin-dashboard", verifyFBToken, verifyAdmin, async (req, res) => {
  const tuitionStats = await tuitionsCollection
    .aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          value: "$count",
        },
      },
    ])
    .toArray();

  const totalTransaction = await paymentsCollection
    .aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          // totalAmount:"$total"
        },
      },
    ])
    .toArray();

  res.send({ tuitionStats, totalTransaction });
});

app.delete("/delete-user", verifyFBToken, verifyAdmin, async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).send({ message: "Bad request" });
  }
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const firebaseAccount = await admin.auth().deleteUser(userRecord.uid);
    const dbAccount = await usersCollection.deleteOne({ email: email });
    res.send({ firebaseAccount, dbAccount });
  } catch (error) {
    console.log("Delete User Error", error);
    res.status(500).send({ message: "Error" });
  }
});

app.patch("/user/role", verifyFBToken, verifyAdmin, async (req, res) => {
  const { role } = req.body;
  const { email } = req.query;
  if (!email || !role) {
    return res.status(400).send({ message: "Bad request" });
  }
  const changeRole = await usersCollection.updateOne(
    { email: email },
    { $set: { role: role } }
  );
  res.send(changeRole);
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
