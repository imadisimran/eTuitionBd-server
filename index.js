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
  let score = 0;
  let totalPoints = 0;
  let missing = [];

  //     {
  // "_id": "69354a0b68ce2d912eb7c120",
  // "displayName": "Imad Imran",
  // "photoURL": "https://i.ibb.co/6cCcqFxZ/628-camedia.png",
  // "email": "imadisimran@gmail.com",
  // "createdAt": "2025-12-07T09:34:03.352Z",
  // "role": "student",
  // "phone": "01743345953",
  // "studentInfo": {
  // "class": "hsc2",
  // "division": "Dhaka",
  // "district": "Dhaka",
  // "address": "Uttor Badda",
  // "guardian": {
  // "relation": "father",
  // "phone": "01713372168"
  // }
  // },
  // "deleteURL": "https://ibb.co/CpGpSQZt/8306f1b7cf12b30eb3d570d12c92fbd0",
  // "icon": "https://i.ibb.co/CpGpSQZt/628-camedia.png"
  // }
  totalPoints++;
  if (user.phone) {
    score++;
  } else {
    missing.push("Phone Number");
  }

  // IF USER IS A STUDENT
  if (user.role === "student") {
    const studentFields = ["class", "division", "district", "address"];

    // Give 20 points for each field
    studentFields.forEach((field) => {
      totalPoints++;
      // Check if studentProfile exists AND the field has data
      if (user.studentInfo && user.studentInfo[field]) {
        score++;
      } else {
        missing.push(field);
      }
    });

    //Checking guardian info
    const guardianFields = ["relation", "phone"];
    guardianFields.forEach((field) => {
      totalPoints++;
      if (
        user.studentInfo &&
        user.studentInfo.guardian &&
        user.studentInfo.guardian[field]
      ) {
        score++;
      } else {
        missing.push(field);
      }
    });
  }

  // IF USER IS A TUTOR
  if (user.role === "tutor") {
    const tutorFields = ["institution", "salary", "bio", "subjects"];

    // Give 20 points for each field
    tutorFields.forEach((field) => {
      totalPoints += 20;
      if (user.tutorProfile && user.tutorProfile[field]) {
        score += 20;
      } else {
        missing.push(field);
      }
    });

    // SPECIAL CHECK: Education Array
    totalPoints += 20;
    if (
      user.tutorProfile &&
      user.tutorProfile.education &&
      user.tutorProfile.education.length > 0
    ) {
      score += 20;
    } else {
      missing.push("Education History");
    }
  }

  const percentage = totalPoints === 0 ? 0 : (score / totalPoints) * 100;

  return {
    percent: Math.round(percentage),
    isReady: percentage === 100, // True if 100%, False if less
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
  const result = await usersCollection.insertOne(userData);
  res.send(result);
});

app.get("/user", async (req, res) => {
  const query = {};
  const email = req.query.email;
  if (email) {
    query.email = email;
  }
  const user = await usersCollection.findOne(query);
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
