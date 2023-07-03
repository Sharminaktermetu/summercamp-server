const express = require('express');
const cors = require('cors');
const app =express();
require('dotenv').config();
const port =process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const jwt = require('jsonwebtoken');
// summerCamp
// fYeb7pXgCIOKNi0y
const verifyJWT =(req,res,next)=>{
  const authorization =req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({error:true, message:'Unauthorized access'})
  }
  // bearer token
  const token =authorization.split(' ')[1];
  jwt.verify(token,process.env.ACCESS_JWT, (err,decoded)=>{
    if (err) {
      return res.status(401).send({error:true, message:'Unauthorized access'})
    }
    req.decoded=decoded;
    next()
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://summerCamp:fYeb7pXgCIOKNi0y@cluster0.pjt1xjf.mongodb.net/?retryWrites=true&w=majority";

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
    await client.connect();

    const cartCollection = client.db("summerCamp").collection("cart");
    const userCollection = client.db("summerCamp").collection("user");
    // JWT token
    app.post('/jwt',(req,res)=>{
      const user =req.body;
      var token = jwt.sign(user, process.env.ACCESS_JWT,{
        expiresIn:1
      }); 
      res.send({token})
    })

    // user server api

    app.get('/user',async(req,res)=>{
      const cursor =userCollection.find();
      const result=await cursor.toArray();
      res.send(result)
    })
    app.post('/user',async(req,res)=>{
        const user =req.body;
        const query={email:user.email}
        const existing= await userCollection.findOne(query);  
        if (existing) {
         return res.send({message:'user already exists'})
        }
        const result =await userCollection.insertOne(user)
        res.send(result)
    })

    app.patch('/user/admin/:id',async(req,res)=>{
      const id =req.params.id;
      const filter ={_id: new ObjectId(id)}
      const updateDoc ={
        $set:{
          role:'admin'
        },
      }
      const result =await userCollection.updateOne(filter,updateDoc);
      res.send(result)
    })
    app.patch('/user/instructor/:id',async(req,res)=>{
      const id =req.params.id;
      const filter ={_id: new ObjectId(id)}
      const updateDoc ={
        $set:{
          role:'instructor'
        },
      }
      const result =await userCollection.updateOne(filter,updateDoc);
      res.send(result)
    })

    // cart collection apis
    app.get('/cart',verifyJWT,async(req,res)=>{
      const email =req.query.email;
      if(!email){
        res.send([]);
      }
      const decodedEmail =req.decoded.email;
      if (email !== decodedEmail) {
      return res.status(401).send({error:true, message:'Unauthorized access'});
      }
      const query ={email:email};
      const result= await cartCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/cart',async(req,res)=>{
        const items =req.body;
        const result =await cartCollection.insertOne(items)
        res.send(result)
    })

    app.delete('/cart/:id',async(req,res)=>{
      const id =req.params.id;
      const query ={_id: new ObjectId(id)}
      const result =await cartCollection.deleteOne(query);
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




app.get("/",(req,res)=>{
    res.send('summer camp open')

})
app.listen(port,()=>{
    console.log(`camp is open on port ${port}`);
})