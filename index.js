const enviroment = require('dotenv').config({ path: __dirname + "/.env" });

// import libraries
const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');

// config port
const PORT = 3000;

// config aws dynamodb
AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION,
});

const docClient = new AWS.DynamoDB.DocumentClient();
const TableName = 'courses';

// middleware
const convertFormToJson = multer();
const app = express();

// require middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./views'));

// config view
app.set('view engine', 'ejs');
app.set('views', './views');

// get all courses
app.get('/', (req, res) => {
  // lấy dữ liệu từ file data.js
  // const courses = require('./data');
  // return res.render('index', { courses });

  // lấy dữ liệu từ dynamodb
  const params = {
    TableName: TableName
  };

  docClient.scan(params, (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Internal Server Error');
    } else {
      const courses = data.Items;
      console.log("List of Courses: \n", JSON.stringify(courses));
      return res.render('index', { courses });
    }
  });
});

app.post('/', convertFormToJson.fields([]), (req, res) => {
  const id = Number(req.body.id);
  const name = req.body.name;
  const course_type = req.body.course_type;
  const semester = req.body.semester;
  const department = req.body.department;

  const params = {
    "id": id,
    "name": name,
    "course_type": course_type,
    "semester": semester,
    "department": department
  }

  courses.push(params);
  return res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
