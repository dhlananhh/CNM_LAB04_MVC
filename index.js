const enviroment = require('dotenv').config({ path: __dirname + "/.env" });

const express = require('express');
const AWS = require('aws-sdk');
require('aws-sdk/lib/maintenance_mode_message').suppress = true;
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
  // Lấy thông tin khóa học từ form
  const { id, name, course_type, semester, department } = req.body;

  // Kiểm tra thông tin khóa học
  if (!id || !name || !course_type || !semester || !department) {
    return res.status(400).send('Bad Request');
  }

  // Tạo thông tin khóa học
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

  // Thêm khóa học vào DynamoDB
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

// Delete a course
app.post('/delete', convertFormToJson.fields([]), (req, res) => {
  // Lấy ID khóa học cần xóa
  const { id } = req.body;

  // Kiểm tra ID khóa học
  // Nếu không có ID thì chuyển hướng về trang chính
  if (!id) {
    return res.redirect('/');
  }

  // Tạo thông tin khóa học cần xóa
  const params = {
    TableName: TableName,
    Key: {
      id: Number(id),
    },
  };

  // Xóa khóa học khỏi DynamoDB
  docClient.delete(params, (err) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Internal Server Error');
    } else {
      console.log(`Course with ID ${id} deleted successfully`);
      return res.redirect('/');
    }
  });
});

// Port listening
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
