const express = require("express")
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
    origin: "http://localhost:5173",

}))

app.use(express.json())

// verifytoken- middleware

const verifyjwt = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.send({ message: "No token" })
    }
    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded) => {
        if (err) {
            return res.send({ message: "Invalid Token" })
        }
        req.decoded = decoded;
        next();
    });
}

//verify saller

const verifySaller = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email }
    const user = await userCollection.findOne(query);
    if (user?.role !== "Saller") {
        return res.send({ message: "Forbidden access" })
    }
    next()
};
const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email }
    const user = await userCollection.findOne(query);
    if (user?.role !== "Admin") {
        return res.send({ message: "Forbidden access" })
    }
    next()
};
const verifyBuyer = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email }
    const user = await userCollection.findOne(query);
    if (user?.role !== "Buyer") {
        return res.send({ message: "Forbidden access" })
    }
    next()
};

//mongodb
const url = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f4wqy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
        tls: true,
    }
})

const dbConnect = async () => {
    try {
        await client.connect()
        await client.db("admin").command({ ping: 1 });
        console.log("Database connected successfully");

        //get User
        app.get("/user/:email", async (req, res) => {
            const query = { email: req.params.email };
            const user = await userCollection.findOne(query);
            res.send(user)
        })

        //get All user
        app.get("/users", async (req, res) => {
            // const query = {email: req.params.email};
            const user = await userCollection.find().toArray();
            res.send(user)
        })



        // insert user
        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: "user already exists" })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        //add-product

        app.post("/add-products", verifyjwt, verifySaller, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result)
        })

        //get product
        app.get("/all-product", async (req, res) => {
            const { title, sort, category, brand, page = 1, limit = 9 } = req.query

            const query = {}

            if (title) {
                query.title = { $regex: title, $options: "i" }
            }
            if (category) {
                query.category = { $regex: category, $options: "i" }
            }
            if (brand) {
                query.brand = brand
            }

            const pageNumber = Number(page)
            const limitNumber = Number(limit)

            const sortOption = sort === 'asc' ? 1 : -1
            const products = await productCollection
                .find(query)
                .skip((pageNumber - 1) * limitNumber)
                .limit(limitNumber)
                .sort({ price: sortOption })
                .toArray();


            const totalProducts = await productCollection.countDocuments(query);

            // const productsInfo = await productCollection.find({}, {projection: {category:1, brand:1}}).toArray()
            const categories = [
                ...new Set(products.map((product) => product.category))
            ]
            const brands = [
                ...new Set(products.map((product) => product.brand))
            ]



            res.json({ products, brands, categories, totalProducts })
        })

        //get products by id
        app.get("/products/:id", async (req, res) => {
            const id = req.params.id
            // console.log(id);
            const product = await productCollection.findOne({
                _id: new ObjectId(String(id))
            })

            if (!product) {
                return res.send({ message: "user not found" })
            }

            // const whishlist = await productCollection.find({ _id: { $in: user.whishList || [] } }).toArray()
            // res.send(whishlist)


            // const product = await productCollection.findById(req.params.id);
                 
            // if (!product) {
            //         return res.send({ message: "product not found" })
            //     }

                res.json(product);
        });







        // get product for featured Section

        app.get("/featured/products", async (req, res) => {

            const product = await productCollection.find().limit(6).toArray();
            res.send(product)
        })


        // add review from contact page
        app.post("/add-reviews", async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result)
        })

        // get review as testimonial from testimonial section

        app.get("/reviews", async (req, res) => {

            const review = await reviewCollection.find().toArray();
            res.send(review)
        })





        // added to wishlist

        app.patch('/wishlist/add', async (req, res) => {

            const { userEmail, productId } = req.body

            const result = await userCollection.updateOne(
                { email: userEmail },
                { $addToSet: { whishList: new ObjectId(String(productId)) } }
            )
            res.send(result)
        })

        // remove frome whishlist
        app.patch('/wishlist/remove', async (req, res) => {

            const { userEmail, productId } = req.body

            const result = await userCollection.updateOne(
                { email: userEmail },
                { $pull: { whishList: new ObjectId(String(productId)) } }
            )
            res.send(result)
        })

        //  get wishlist

        app.get("/whishlist/:userId", verifyjwt, async (req, res) => {
            const userId = req.params.userId
            const user = await userCollection.findOne({
                _id: new ObjectId(String(userId))
            })

            if (!user) {
                return res.send({ message: "user not found" })
            }

            const whishlist = await productCollection.find({ _id: { $in: user.whishList || [] } }).toArray()
            res.send(whishlist)

        })


        //add to cart

        app.patch('/cart/add', async (req, res) => {

            const { userEmail, productId } = req.body

            const result = await userCollection.updateOne(
                { email: userEmail },
                { $addToSet: { cart: new ObjectId(String(productId)) } }
            )
            res.send(result)
        })

        // get carts

        app.get("/cart/:userId", verifyjwt, async (req, res) => {
            const userId = req.params.userId
            const user = await userCollection.findOne({
                _id: new ObjectId(String(userId))
            })

            if (!user) {
                return res.send({ message: "user not found" })
            }

            const cart = await productCollection.find({ _id: { $in: user.cart || [] } }).toArray()
            res.send(cart)

        })

        // remove frome cart
        app.patch('/cart/remove', async (req, res) => {

            const { userEmail, productId } = req.body

            const result = await userCollection.updateOne(
                { email: userEmail },
                { $pull: { cart: new ObjectId(String(productId)) } }
            )
            res.send(result)
        })






        // get seller product

        app.get("/sellerProduct/:sallerEmail", async (req, res) => {
            // const sallerEmail= req.params.sallerEmail
            const query = { sallerEmail: req.params.sallerEmail };


            const sellerProduct = await productCollection.find(query).project({ brand: 1, price: 1, title: 1, stock: 1 }).toArray();

            if (sellerProduct.length === 0) {
                return res.send({ message: "No products found for this seller" });
            }

            res.send(sellerProduct)

        })

        //delete user infor from by admin

        app.delete("/deleteUserInfo/:id", async (req, res) => {
            const userId = req.params.id; // Get the product ID from the request parameters

            const result = await userCollection.deleteOne({ _id: new ObjectId(String(userId)) });

            if (result.deletedCount === 0) {
                return res.status(404).send({ message: "Product not found" });
            }

            res.send({ message: "Product deleted successfully" });
        });



    } catch (error) {
        console.log(error.name, error.message);
    }
}
dbConnect()

const userCollection = client.db("shopverse").collection("users")
const productCollection = client.db("shopverse").collection("products")
const reviewCollection = client.db("shopverse").collection("reviews")


//api
app.get("/", (req, res) => {
    res.send("Server is runninggg")
})


//jwt

app.post('/authen', (req, res) => {
    const userEmail = req.body
    const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, {
        expiresIn: "10d"
    })
    res.send({ token, success: true, message: 'Authenticated!' });
})

app.listen(port, () => {
    console.log(`Server is running on ${port}`);
})