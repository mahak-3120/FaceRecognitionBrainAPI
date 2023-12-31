const express = require("express");
const bcrypt = require("bcrypt-nodejs");
const cors = require("cors");
const knex = require("knex");

// Clarifai section
const { ClarifaiStub, grpc } = require("clarifai-nodejs-grpc");

const stub = ClarifaiStub.grpc();
const metadata = new grpc.Metadata();
metadata.set("authorization", "Key 815f303f12de41a2947ad7baa3d28494");
// if DEV
// connection: {
//   host: "127.0.0.1",
//   user: "postgres",
//   port: 5432,
//   password: "admin",
//   database: "smart-brain",
// },

const db = knex({
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    host: process.env.DATABASE_HOST,
    port: 5432,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PW,
    database: process.env.DATABASE_DB,
  },
});

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Success");
});

app.post("/signin", (req, res) => {
  const { email, password } = req.body;
  db.select("email", "hash")
    .from("login")
    .where("email", "=", email)
    .then((data) => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        return db
          .select("*")
          .from("users")
          .where("email", "=", email)
          .then((user) => {
            res.json(user[0]);
          })
          .catch((err) => res.status(400).json("Unable to get user"));
      } else {
        res.status(400).json("Wrong credentials");
      }
    })
    .catch((err) => res.status(400).json("Wrong email or password"));
});

app.post("/register", (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json("No credentials");
  }
  const hash = bcrypt.hashSync(password);
  db.transaction((trx) => {
    trx
      .insert({
        hash: hash,
        email: email,
      })
      .into("login")
      .returning("email")
      .then((loginEmail) => {
        return trx("users")
          .returning("*")
          .insert({
            email: loginEmail[0].email,
            name: name,
            joined: new Date(),
          })
          .then((user) => {
            res.json(user[0]);
          });
      })
      .then(trx.commit)
      .catch(trx.rollback);
  }).catch((err) => res.status(400).json("Unable to register"));
});

app.get("/profile/:id", (req, res) => {
  const { id } = req.params;

  db.select("*")
    .from("users")
    .where({ id })
    .then((user) => {
      user.length
        ? res.json(user[0])
        : res.status(400).json("No user found with given id");
    })
    .catch((err) => console.log(err));
});

app.post("/imageurl", (req, res) => {
  // OLD way of doing
  // fetch(
  //   "https://api.clarifai.com/v2/models/" + "face-detection" + "/outputs",
  //   clarifaiRequestOptions(req.body.input)
  // )
  //   .then((data) => res.json(data))
  //   .catch((err) => res.status(400).json("Unable to work with API"));

  // grpc way
  stub.PostModelOutputs(
    {
      // This is the model ID of a publicly available General model. You may use any other public or custom model ID.
      model_id: "face-detection",
      inputs: [{ data: { image: { url: req.body.input } } }],
    },
    metadata,
    (err, response) => {
      if (err) {
        console.log("Error: " + err);
        return;
      }

      if (response.status.code !== 10000) {
        console.log(
          "Received failed status: " +
            response.status.description +
            "\n" +
            response.status.details
        );
        return;
      }
      res.json(response);
    }
  );
});

app.put("/image", (req, res) => {
  const { id } = req.body;
  db("users")
    .where("id", "=", id)
    .increment("entries", 1)
    .returning("entries")
    .then((entries) => {
      res.json(entries[0].entries);
    })
    .catch((err) => res.status(400).json("Unable to get entries"));
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`app is listening on port 5000 ${process.env.PORT}`);
});

// DB user password: admin
