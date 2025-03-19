const enviroment = require('dotenv').config({ path: __dirname + "/.env" });

const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');

// Config port
const PORT = 4000;

// Config AWS DynamoDB
AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION,
});

const docClient = new AWS.DynamoDB.DocumentClient();
const TableName = 'courses';

// Middleware
const convertFormToJson = multer();
const app = express();

// Require middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./views'));

// Config view
app.set('view engine', 'ejs');
app.set('views', './views');

// Get all courses
app.get('/', (req, res) => {
  const params = {
    TableName: TableName,
  };

  docClient.scan(params, (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Internal Server Error');
    } else {
      const courses = data.Items;
      return res.render('index', { courses });
    }
  });
});

// Add a new course
app.post('/', convertFormToJson.fields([]), (req, res) => {
  const { id, name, course_type, semester, department } = req.body;

  const params = {
    TableName: TableName,
    Item: {
      id: Number(id),
      name: name,
      course_type: course_type,
      semester: semester,
      department: department,
    },
  };

  docClient.put(params, (err) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Internal Server Error');
    } else {
      console.log('New course added successfully');
      return res.redirect('/');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
