import express from "express";
import cors from "cors";
import axios from "axios";
import { fileURLToPath } from "url";
import path from "path";
import { promises as fs } from "fs";

const app = express();

// Recreate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment Configuration
const PORT = process.env.PORT || 4322;
const CORS_ORIGIN = 'https://wage-map.vercel.app';
const OCC_API_URL = 'https://delaware-app.datausa.io/api/searchLegacy?dimension=PUMS%20Occupation&hierarchy=Detailed%20Occupation&limit=50000';
const DATAUSA_BASE_URL = 'http://datausa.io/api/data';

// Axios Configuration
const axiosInstance = axios.create({
    timeout: 10000, // 10 seconds timeout
});

// Global Axios Error Interceptor
axiosInstance.interceptors.response.use(
    response => response,
    error => {
        logError(error, { type: 'Axios Request Error' });
        return Promise.reject(error);
    }
);

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));

// Global variable to store occupation list
let occList = [];

// Robust Error Logging Utility
function logError(error, context = {}) {
    console.error(JSON.stringify({
        message: error.message,
        stack: error.stack,
        context: context,
        timestamp: new Date().toISOString()
    }));
}

// Comprehensive Error Handling Utility
function handleApiError(error, res) {
    logError(error, { type: 'API Error' });
    
    if (error.response) {
        res.status(error.response.status).json({
            message: 'API request failed',
            details: error.response.data,
            status: 'error'
        });
    } else if (error.request) {
        res.status(500).json({
            message: 'No response received from API',
            status: 'network_error'
        });
    } else {
        res.status(500).json({
            message: 'Error processing request',
            error: error.message,
            status: 'server_error'
        });
    }
}

// Routes with Improved Error Handling and Validation

app.get("/", (req, res) => {
    res.send("Server is running in Vercel");
});

app.get('/fetch-occupations', async (req, res) => {
    try {
        const filePath = path.join(__dirname, "occref.json");
        const jsonData = JSON.parse(await fs.readFile(filePath, "utf-8"));
        res.json(jsonData.occupations);
        const occArray = jsonData.occupations
            .map(occ => ({
                id: occ.id,
                label: occ.name
            }))
            .sort((a, b) => a.label.toUpperCase().localeCompare(b.label.toUpperCase()));
            res.json({
                total_occupations: occArray.length, 
                occupations: occArray
            });
    } catch (error) {
        logError(error, { type: 'Initialization Error' });
        res.json({"Error message": error});
    }
});

app.get('/occupations', async (req, res) => {
    try {
        const { 
            id: occId, 
            sort: occSort, 
            all_years: allYears, 
            state 
        } = req.query;
        
        // Validate required parameters
        if (!occId) {
            return res.status(400).json({ 
                message: 'Occupation ID is required',
                status: 'error'
            });
        }

        const occWagesData = `${DATAUSA_BASE_URL}?drilldowns=Year,State&measures=Average Wage,Average Wage Appx MOE&Record Count>=5&Workforce Status=true&Detailed Occupation=${occId}`;
        const response = await axiosInstance.get(occWagesData);
        const responseArr = response.data.data;

        if (!responseArr || responseArr.length === 0) {
            return res.status(404).json({ 
                message: 'No data found for the specified occupation',
                status: 'not_found'
            });
        }

        const selectedData = [];
        const allYearsArr = { years: [], wages: [] };
        const statesArr = [];
        const wagesArr = [];

        responseArr.forEach(occupation => {
            const aveWage = occupation["Average Wage"] 
                ? parseFloat(occupation["Average Wage"]).toFixed(0) 
                : "0.00";
            const wageMOE = occupation["Average Wage Appx MOE"] 
                ? parseFloat(occupation["Average Wage Appx MOE"]).toFixed(0) 
                : "0.00";

            if (occupation["State"] !== "#null" && occupation["State"] !== "Puerto Rico") {
                if (occupation["Year"] === "2022") {
                    selectedData.push({ 
                        state: occupation["State"], 
                        wage: aveWage, 
                        wageMOE: wageMOE 
                    });
                }
                
                if (allYears === "true" && 
                    occupation["ID Detailed Occupation"] === occId && 
                    occupation.State === state) {
                    allYearsArr.years.unshift(occupation["Year"]);
                    allYearsArr.wages.unshift(aveWage);
                }
            }
        });

        if (allYearsArr.years.length) {
            return res.json(allYearsArr);
        }

        // Sorting logic
        if (occSort === 'alpha') {
            selectedData.sort((a, b) => a.state.localeCompare(b.state));
        } else if (occSort === 'wageDes') {
            selectedData.sort((a, b) => parseFloat(b.wage) - parseFloat(a.wage));
        } else if (occSort === 'wageAsc') {
            selectedData.sort((a, b) => parseFloat(a.wage) - parseFloat(b.wage));
        }

        selectedData.forEach(el => {
            statesArr.push(el.state);
            wagesArr.push(parseFloat(el.wage));
        });

        return res.json({
            wages: wagesArr,
            states: statesArr
        });

    } catch (error) {
        handleApiError(error, res);
    }
});
app.get('/test', async (req, res) => {
    try {
        const filePath = path.join(__dirname, "occref.json");
        const jsonData = JSON.parse(await fs.readFile(filePath, "utf-8"));
        res.json(jsonData);
    } catch (error) {
        if (error.code === "ENOENT") {
            res.status(404).json({ error: "File not found" });
        } else {
            console.error("Error reading file:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
});
// Start Server
app.listen(PORT, () => console.log(`Server started on Port ${PORT}`));