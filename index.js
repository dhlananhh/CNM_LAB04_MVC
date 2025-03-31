require('dotenv').config(); // Load environment variables first
const express = require('express');
const AWS = require('aws-sdk');
require('aws-sdk/lib/maintenance_mode_message').suppress = true; // Suppress SDK update messages if needed

// --- AWS Configuration ---
AWS.config.update({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION,
});

// Initialize DynamoDB DocumentClient for easier JSON handling
const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 4000;

// --- Middleware ---
// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));
// Parse JSON bodies (useful for API requests, though not used in this form-based example)
// app.use(express.json());
// Serve static files (like CSS) from the 'views' directory (or a dedicated 'public' directory)
app.use(express.static('views')); // If you have separate CSS files

// --- View Engine Setup ---
app.set('view engine', 'ejs');
app.set('views', './views');

// --- Routes ---

/**
 * READ ALL Courses (GET /)
 * Fetches all items from the DynamoDB table and renders the index page.
 */
app.get('/', async (req, res) => {
    const params = {
        TableName: tableName,
    };

    try {
        const data = await docClient.scan(params).promise();
        console.log('Successfully scanned courses:', JSON.stringify(data.Items, null, 2));
        res.render('index', { courses: data.Items || [] }); // Pass empty array if no items
    } catch (err) {
        console.error('Error scanning courses:', JSON.stringify(err, null, 2));
        res.status(500).send('Internal Server Error: Could not fetch courses.');
    }
});

/**
 * CREATE Course (POST /add)
 * Adds a new course item to the DynamoDB table.
 */
app.post('/add', async (req, res) => {
    // Extract data from form submission
    const { id, name, course_type, semester, department } = req.body;

    // Basic Validation
    if (!id || !name || !course_type || !semester || !department) {
        return res.status(400).send('Bad Request: All fields are required.');
    }

    const params = {
        TableName: tableName,
        Item: {
            id: Number(id), // Ensure ID is stored as a Number
            name: name,
            course_type: course_type,
            semester: semester,
            department: department,
        },
        // Optional: Add a condition to prevent overwriting an existing item with the same ID
        // ConditionExpression: "attribute_not_exists(id)"
    };

    try {
        await docClient.put(params).promise();
        console.log(`Successfully added course with ID: ${id}`);
        res.redirect('/'); // Redirect back to the main list
    } catch (err) {
        console.error(`Error adding course with ID ${id}:`, JSON.stringify(err, null, 2));
        // Handle potential ConditionCheckFailedException if using ConditionExpression
        // if (err.code === 'ConditionalCheckFailedException') {
        //     return res.status(409).send('Conflict: Course with this ID already exists.');
        // }
        res.status(500).send(`Internal Server Error: Could not add course.`);
    }
});

/**
 * DELETE Course (POST /delete)
 * Deletes a course item from the DynamoDB table based on ID.
 */
app.post('/delete', async (req, res) => {
    const { id } = req.body;

    // Basic Validation
    if (!id) {
        // Maybe show an error message instead of just redirecting
        console.warn('Attempted to delete without providing an ID.');
        return res.redirect('/');
        // return res.status(400).send('Bad Request: Course ID is required for deletion.');
    }

    const params = {
        TableName: tableName,
        Key: {
            id: Number(id), // Key must match the data type in DynamoDB
        },
        // Optional: Add a condition to ensure the item exists before deleting
        // ConditionExpression: "attribute_exists(id)"
    };

    try {
        await docClient.delete(params).promise();
        console.log(`Successfully deleted course with ID: ${id}`);
        res.redirect('/');
    } catch (err) {
        console.error(`Error deleting course with ID ${id}:`, JSON.stringify(err, null, 2));
        // Handle potential ConditionCheckFailedException
        // if (err.code === 'ConditionalCheckFailedException') {
        //     return res.status(404).send('Not Found: Course with this ID does not exist.');
        // }
        res.status(500).send('Internal Server Error: Could not delete course.');
    }
});


/**
 * SHOW Update Form (GET /update/:id)
 * Fetches a single course by ID and renders the update form with pre-filled data.
 */
app.get('/update/:id', async (req, res) => {
    const id = Number(req.params.id); // Get ID from URL parameter

    if (isNaN(id)) {
       return res.status(400).send('Invalid Course ID.');
    }

    const params = {
        TableName: tableName,
        Key: {
            id: id,
        },
    };

    try {
        const data = await docClient.get(params).promise();
        if (!data.Item) {
            console.log(`Course with ID ${id} not found for update.`);
            return res.status(404).send('Course not found.');
        }
        console.log(`Rendering update form for course ID: ${id}`);
        res.render('update', { course: data.Item }); // Pass course data to the update view
    } catch (err) {
        console.error(`Error fetching course ${id} for update:`, JSON.stringify(err, null, 2));
        res.status(500).send('Internal Server Error: Could not fetch course details.');
    }
});


/**
 * UPDATE Course (POST /update/:id)
 * Updates an existing course item in DynamoDB.
 */
app.post('/update/:id', async (req, res) => {
    const idParam = Number(req.params.id); // ID from URL
    const { name, course_type, semester, department } = req.body; // Updated data from form

    if (isNaN(idParam)) {
        return res.status(400).send('Invalid Course ID in URL.');
    }

    // Construct the UpdateExpression and related attributes dynamically
    let updateExpression = 'SET ';
    const expressionAttributeValues = {};
    const expressionAttributeNames = {}; // Needed if attribute names are reserved keywords

    let updateParts = [];

    // Add fields to update only if they are provided in the form body
    if (name) {
        updateParts.push('#n = :n'); // Use placeholders for attribute names
        expressionAttributeValues[':n'] = name;
        expressionAttributeNames['#n'] = 'name'; // Map placeholder to actual attribute name
    }
    if (course_type) {
        updateParts.push('#ct = :ct');
        expressionAttributeValues[':ct'] = course_type;
        expressionAttributeNames['#ct'] = 'course_type';
    }
    if (semester) {
        updateParts.push('#s = :s');
        expressionAttributeValues[':s'] = semester;
        expressionAttributeNames['#s'] = 'semester';
    }
    if (department) {
        updateParts.push('#d = :d');
        expressionAttributeValues[':d'] = department;
        expressionAttributeNames['#d'] = 'department';
    }

    // Check if any fields are actually being updated
    if (updateParts.length === 0) {
        console.warn(`Update attempt for ID ${idParam} with no fields to update.`);
        // Optionally redirect or send a message
        return res.redirect('/'); // Or: res.status(400).send('No fields provided for update.');
    }

    updateExpression += updateParts.join(', ');

    const params = {
        TableName: tableName,
        Key: {
            id: idParam, // Use the ID from the URL parameter
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames, // Include this map
        ReturnValues: 'UPDATED_NEW', // Optional: returns the item attributes as they appeared after the update
        // Optional: Add a condition to ensure the item exists before updating
        // ConditionExpression: "attribute_exists(id)"
    };

    try {
        const data = await docClient.update(params).promise();
        console.log(`Successfully updated course with ID ${idParam}:`, JSON.stringify(data.Attributes, null, 2));
        res.redirect('/'); // Redirect after successful update
    } catch (err) {
        console.error(`Error updating course ${idParam}:`, JSON.stringify(err, null, 2));
         // Handle potential ConditionCheckFailedException
        // if (err.code === 'ConditionalCheckFailedException') {
        //     return res.status(404).send('Not Found: Course with this ID does not exist for update.');
        // }
        res.status(500).send('Internal Server Error: Could not update course.');
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
