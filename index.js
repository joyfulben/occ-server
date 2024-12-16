import express from "express";
const app = express();
import cors from "cors";
import axios from "axios";
const occList = [];
app.use(cors({ origin: 'https://wage-map.vercel.app' }));
async function initializeApp (){
    try {
        // API URLS
        const occAPIData = 'https://delaware-app.datausa.io/api/searchLegacy?dimension=PUMS%20Occupation&hierarchy=Detailed%20Occupation&limit=50000';
        const specOccAPIData = 'http://datausa.io/api/data?drilldowns=Year,State&measures=Average Wage,Average Wage Appx MOE&Record Count>=5&Workforce Status=true&Detailed Occupation='
        // Make GET request to the third-party API
        const response = await axios.get(occAPIData);
        // Make an array of objects containing the occupation id and title.
        const apiData = response.data.results
        let occArray = [];
        for (const occ of apiData) {
            if (!occ.id.includes("X")) { // Filter out occupations with "X" in their id
                occArray.push({ "id": occ.id, "label": occ.name });
            }
          }
          occArray = occArray.sort(function(a, b) {
            var textA = a.label.toUpperCase();
            var textB = b.label.toUpperCase();
            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
        });
        // Send the response data back to the client
        occArray.forEach(async el => {
            let res = await axios.get(specOccAPIData+el.id);
            if (res.data.length){
                occList.push(el);
            }
        });
    } catch (error) {
      // Handle any errors
      console.error('Error fetching data:', error);
      res.status(500).json({ message: 'Error fetching data from the API' });
    }
};
app.get("/", (req, res)=> {
    res.send("Server is running in Vercel");
});
app.get('/fetch-occupations', async (req, res) => {
    res.json({total_occupations:occList.length, occupations: occList});
});
    
app.get('/occupations', async (req, res) => {
    try {
        const occId = req.query.id;
        const occSort = req.query.sort;
        const allYears = req.query.all_years;
        const state = req.query.state;
        let selectedData = [];
        const statesArr = [];
        const wagesArr = [];
        let allYearsArr = { years: [], wages: [] }; // Fixed to match expected structure

        // Function to format state and wage arrays
        function formatArrays() {
            selectedData.forEach(el => {
                statesArr.push(el.state);
                wagesArr.push(parseFloat(el.wage));
            });
        }

        // API URL
        const occWagesData = `http://datausa.io/api/data?drilldowns=Year,State&measures=Average Wage,Average Wage Appx MOE&Record Count>=5&Workforce Status=true&Detailed Occupation=${occId}`;
        
        // Fetch data
        const response = await axios.get(occWagesData);
        const responseArr = response.data.data;

        responseArr.forEach(occupation => {
            const aveWage = occupation["Average Wage"] ? parseFloat(occupation["Average Wage"]).toFixed(0) : "0.00";
            const wageMOE = occupation["Average Wage Appx MOE"] ? parseFloat(occupation["Average Wage Appx MOE"]).toFixed(0) : "0.00";
            if (occupation["State"]!="#null" && occupation["State"]!="Puerto Rico"){
                if (occupation["Year"] === "2022") {
                    selectedData.push({ state: occupation["State"], wage: aveWage, wageMOE: wageMOE });
                }
                
                if (allYears === "true" && occupation["ID Detailed Occupation"] === occId && occupation.State === state) {
                    allYearsArr.years = [occupation["Year"],...allYearsArr.years];
                    allYearsArr.wages = [aveWage,...allYearsArr.wages];
                }
            }
        });

        if (allYearsArr.years.length) {
            return res.json(allYearsArr); // Use `return` to stop execution
        }

        const stateWageArrays = {
            wages: wagesArr,
            states: statesArr
        };

        if (occSort === 'alpha') {
            formatArrays();
            return res.json(stateWageArrays); // Alpha sorting
        } else if (occSort === 'wageDes') {
            selectedData.sort((a, b) => parseFloat(b.wage) - parseFloat(a.wage));
            formatArrays();
            return res.json(stateWageArrays); // Wage descending
        } else if (occSort === 'wageAsc') {
            selectedData.sort((a, b) => parseFloat(a.wage) - parseFloat(b.wage));
            formatArrays();
            return res.json(stateWageArrays); // Wage ascending
        }

        // Default response if no conditions are met
        res.status(400).json({ message: 'Invalid query parameters',query_params: req.query });
    } catch (error) {
        console.error('Error fetching occupation data', error);
        res.status(500).json({ message: 'Error fetching specific occupation wage data from the API' });
    }
});

app.listen(4322, console.log("Server started on Port 4322"));
initializeApp();