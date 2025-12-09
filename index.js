const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

//Middleware
app.use(express.json());
app.use(cors());

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

  // --- Check Root Info ---
  checkField(user.phone, "Phone Number");

  // --- Check Student Info ---
  if (user.role === "student") {
    // fields with specific human-readable labels
    const studentChecks = [
      { key: "class", label: "Class" },
      { key: "division", label: "Division" },
      { key: "district", label: "District" },
      { key: "address", label: "Address" },
    ];

    studentChecks.forEach((item) => {
      // Use optional chaining (?.) to safely access nested data
      const value = user.studentInfo?.[item.key];
      checkField(value, item.label);
    });

    // --- Check Guardian Info ---
    const guardianChecks = [
      { key: "relation", label: "Guardian Relation" },
      { key: "phone", label: "Guardian Phone Number" },
    ];

    guardianChecks.forEach((item) => {
      // Safely access user -> studentInfo -> guardian -> key
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
    role: "student",
  };
  // console.log(req.headers.authorization)
  const result = await usersCollection.insertOne(userData);
  // console.log(result)
  res.send(result);
});

app.get("/user", async (req, res) => {
  const query = {};
  const { email, role } = req.query;
  if (email) {
    query.email = email;
  }
  const user = await usersCollection.findOne(query);
  const profileStatus = checkProfile(user);
  user.profileStatus = profileStatus;
  res.send(user);
});

app.patch("/user", async (req, res) => {
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
  } = req.body;
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

app.get("/user/role", async (req, res) => {
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

app.post("/tuitions", async (req, res) => {
  const { email } = req.query;
  const query = {};
  if (email) {
    query.email = email;
  } else {
    res.status(404).send({ message: "Not found" });
  }

  const userData = await usersCollection.findOne(query);

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
