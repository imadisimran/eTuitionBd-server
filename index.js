const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

//Middleware
app.use(express.json());
app.use(cors());

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
  const {email}=req.query
  const query = {};
  query.email=email
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
