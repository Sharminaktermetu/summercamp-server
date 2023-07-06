const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_KEY);

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'Unauthorized access' });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_JWT, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pjt1xjf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const cartCollection = client.db("summerCamp").collection("cart");
    const classCollection = client.db("summerCamp").collection("class");
    const userCollection = client.db("summerCamp").collection("user");
    const paymentCollection = client.db("summerCamp").collection("payment");
    // JWT token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      var token = jwt.sign(user, process.env.ACCESS_JWT, {
        expiresIn: '5h'
      });
      res.send({ token })
    })

    // verifyadmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query)
      if (user?.role !== 'admin') {
        return res.status(401).send({ error: true, message: 'Unauthorized access' })
      }
      next()
    }
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query)
      if (user?.role !== 'instructor') {
        return res.status(401).send({ error: true, message: 'Unauthorized access' })
      }
      next()
    }

    // class related api
    app.get('/class', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result)
    })
    app.post('/class', async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result)

    })

    app.patch('/class/approve/:id', async (req, res) => {
      const id = req.params.id;

      try {
        // Update the class status to "Approved" in the database
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: 'Approved' }
        };
        const result = await classCollection.updateOne(filter, updateDoc);

        res.send({ success: true, message: 'Class approved' });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: 'Internal server error' });
      }
    });
    // deny api
    // Backend code (Node.js - Express)
// ...

    // Deny class
    app.patch('/class/deny/:id', async (req, res) => {
      const id = req.params.id;

      try {
        // Update the class status to "Denied" in the database
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: 'Deny' }
        };
        const result = await classCollection.updateOne(filter, updateDoc);

        res.send({ success: true, message: 'Class denied' });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: 'Internal server error' });
      }
    });

// ...

    // --------------//
    app.get('/classes-by-instructor', verifyJWT,verifyInstructor, async (req, res) => {

      const instructorEmail = req.query.instructorEmail;

      if (!instructorEmail) {
        return res.status(400).send('Missing instructorEmail parameter');
      }

      const query = { instructorEmail: instructorEmail };
      const classes = await classCollection.find(query).toArray();
      const classCount = await classCollection.countDocuments(query);

      res.send({
        classes: classes,
        classCount: classCount
      });

    });

    // payment 
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      });
    });

    app.post('/payment', verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      const query = { _id: { $in: payment.itemsId.map(id => new ObjectId(id)) } }
      const deleteResult = await cartCollection.deleteMany(query)
      res.send({ result, deleteResult })

    })
    app.get('/payment/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }; // Modify 'email' to match the field name in your payment collection

      const paymentHistory = await paymentCollection.find(query).toArray();
      res.send(paymentHistory);

    });

    
    // user server api
    app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })
    app.post('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existing = await userCollection.findOne(query);
      if (existing) {
        return res.send({ message: 'user already exists' })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })
    // admin protected route
    app.get('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })



    // instructor protected route
    app.get('/user/instructor/:email',verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
        return;
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);

      if (user && user.role === 'instructor') {

        const instructorInfo = user.instructorInfo;
        const photoURL = user.photoURL;
        res.send({ instructor: true, instructorInfo: instructorInfo, photoURL: photoURL });
      } else {
        res.send({ instructor: false });
      }
    });
    app.get('/instructors', async (req, res) => {
      const query = { role: 'instructor' };
      const instructors = await userCollection.find(query).toArray();
      res.send(instructors);
    });
    //  make madmin role api
    app.patch('/user/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    // make instructor role api
    app.patch('/user/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // cart collection apis
    app.get('/cart', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' });
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/cart', async (req, res) => {
      const items = req.body;
      const result = await cartCollection.insertOne(items)
      res.send(result)
    })

    app.delete('/cart/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get("/", (req, res) => {
  res.send('summer camp open')

})
app.listen(port, () => {
  console.log(`camp is open on port ${port}`);
})