const express=require('express')
const app=express();
const cors=require('cors');
const mongoose=require('mongoose');
const User=require('./models/User');
const bcrypt=require('bcryptjs');
const cookieParser=require('cookie-parser')
const jwt=require('jsonwebtoken');
const imageDownloader=require('image-downloader');
const multer=require('multer');
const fs=require('fs');
const Places=require('./models/Places');
const Booking=require('./models/Booking')
const PORT=process.env.PORT || 5000;

require('dotenv').config();
app.use(express.json());

const scrt=bcrypt.genSaltSync(15);
const jwtScrt=process.env.JWT_SECRET;

app.use(cors({
    credentials:true,
    origin:process.env.BASE_URL, 
}
));
app.use(cookieParser());

app.use('/uploads',express.static(__dirname+'/uploads'));

mongoose.connect(process.env.MONGO_URL)

app.get('/test',(req,res)=>{
    res.json('test ok');
})
function getUserDataFromReq(req) {
    return new Promise((resolve, reject) => {
      jwt.verify(req.cookies.token, jwtScrt, {}, async (err, userData) => {
        if (err) throw err;
        resolve(userData);
      });
    });
  }
  
app.post('/register',async(req,res)=>{
    try{
        const{name,email,password}=req.body;
        const userDetails=await User.create({
             name,email,password:bcrypt.hashSync(password,scrt),
         })
         res.json(userDetails);
    }
   catch(err)
   {
    res.status(422).json(err);
   }
})

app.post('/login',async(req,res)=>{
    const {email,password}=req.body;
    const userDet=await User.findOne({email});
    if(userDet){
        const psdchk=bcrypt.compareSync(password,userDet.password);
        if(psdchk)
        {
            jwt.sign({email:userDet.email,id:userDet._id},jwtScrt,{},(err,token)=>{
                if(err) throw err;
                res.cookie('token',token).json(userDet);
            })
        }
        else{
            res.status(422).json('Wrong Password!!');
        }
    }
    else
    {
        res.json('Not Found');
    }
})

app.get('/profile',(req,res)=>{
    const{token}=req.cookies;
    if(token){
        jwt.verify(token,jwtScrt,{},async(err,userData)=>{
            if(err) throw err;
            const {name,email,_id}=await User.findById(userData.id);
            res.json({name,email,_id});
        })
    }
    else{
        res.json(null);
    }
})

app.post('/logout',(req,res)=>{
    res.cookie('token','').json(true);
})

app.post('/upload-by-link',async(req,res)=>{
    const {link}=req.body;
    const iName='photo'+Date.now()+'.jpg';
   await imageDownloader.image({
        url:link,
        dest:__dirname+'/uploads/'+iName,
    });
    res.json(iName);
})
const photosMiddleware=multer({dest:'uploads/'})
app.post('/upload',photosMiddleware.array('photos',100),(req,res)=>{
    const uploadedFiles=[];
    for(let i=0;i<req.files.length;i++)
    {
        const {path,originalname}=req.files[i];
        const parts=originalname.split('.');
        const ext=parts[parts.length-1];
        const newPath=path+'.'+ext;
        fs.renameSync(path,newPath);
        uploadedFiles.push(newPath.replace('uploads',''));
    }
    res.json(uploadedFiles);
})

app.post('/places',(req,res)=>{
    const{token}=req.cookies;
    const {
        title,address,photos,description,
        perks,extraInfo,checkIn,checkOut,maxGuests,price,
      } = req.body;
        jwt.verify(token,jwtScrt,{},async(err,userData)=>{
            if(err) throw err;
            const PlaceInfo= await Places.create({
                owner:userData.id,
                title,address,photos,description,
                perks,extraInfo,checkIn,checkOut,maxGuests,price,
            })
            res.json(PlaceInfo);
        })
})

app.get('/user-places',(req,res)=>{
    const{token}=req.cookies;
    jwt.verify(token,jwtScrt,{},async(err,userData)=>{
       const{id}=userData;
       res.json(await Places.find({owner:id}))
        })
})
app.get('/places/:id', async (req,res) => {
    const {id} = req.params;
    res.json(await Places.findById(id));
  });

app.put('/places',async(req,res)=>{
    const {token}=req.cookies;
    const {
        id,title,address,photos,description,
        perks,extraInfo,checkIn,checkOut,maxGuests,price,
    }=req.body;
    
    jwt.verify(token,jwtScrt,{},async(err,userData)=>{
        if(err) throw err;
        const placeDoc=await Places.findById(id);

        if(userData.id===placeDoc.owner.toString())
        {
            placeDoc.set( {
                title,address,photos,description,
                perks,extraInfo,checkIn,checkOut,maxGuests,price,});
            await placeDoc.save();
            res.json('ok');
        }

         })
})

app.get('/places', async (req,res) => {
    res.json( await Places.find() );
  });

app.post('/bookings',async(req,res)=>{
    const userData = await getUserDataFromReq(req);
    const {
        place,checkIn,checkOut,NoOfDays,name,mob,price,
    }=req.body;
   await Booking.create({
        place,checkIn,checkOut,NoOfDays,name,mob,price,user:userData.id,
    }).then((doc)=>{
        res.json(doc);
    }).catch((err)=>{
        throw err;
    })
})

app.get('/bookings',async(req,res)=>{
    const userData = await getUserDataFromReq(req);
    res.json( await Booking.find({user:userData.id}).populate('place'));
})
app.listen(PORT,()=>{
    console.log(`Server is listening at port no. ${PORT}`);
});