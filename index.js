import express from "express";
const app = express();
import axios from "axios";

app.get("/", (req, res)=> {
    res.send("Server is running");
});
app.get('/fetch-occupations', async (req, res) => {
    try {
        // API URLS
        const occAPIData = 'https://delaware-app.datausa.io/api/searchLegacy?dimension=PUMS%20Occupation&hierarchy=Detailed%20Occupation&limit=50000';
        const specOccAPIData = 'http://datausa.io/api/data?drilldowns=Year,State&measures=Average Wage,Average Wage Appx MOE&Record Count>=5&Workforce Status=true&Detailed Occupation='
        // Make GET request to the third-party API
        const response = await axios.get(occAPIData);
        // Make an array of objects containing the occupation id and title.
        const apiData = response.data.results
        const occArray = [];
        for (const occ of apiData) {
            if (!occ.id.includes("X")) { // Filter out occupations with "X" in their id
                occArray.push({ "id": occ.id, "title": occ.name });
            }
          }
        // Send the response data back to the client
        res.json({total_occupations:occArray.length, occupations: occArray});
    } catch (error) {
      // Handle any errors
      console.error('Error fetching data:', error);
      res.status(500).json({ message: 'Error fetching data from the API' });
    }
  });
app.get('/occupations', async (req, res) => {
    try{
        const occId = req.query.id;
        const occSort = req.query.sort;
        const selectedData = [];
        //API URL
        const occWagesData = `http://datausa.io/api/data?drilldowns=Year,State&measures=Average Wage,Average Wage Appx MOE&Record Count>=5&Workforce Status=true&Detailed Occupation=${occId}`;
        //Fetch data
        const response = await axios.get(occWagesData);
        const responseArr = response.data.data;
        responseArr.forEach(occupation => {
            if (occupation["Year"]==="2022"){
                const aveWage = occupation["Average Wage"].toFixed(2);
                const wageMOE = occupation["Average Wage Appx MOE"].toFixed(2);
                selectedData.push({state:occupation["State"],wage:aveWage,wageMOE});
            }
        });
        if (occSort === 'alpha'){
            res.json(selectedData);
        }else if(occSort === 'wageDes'){
            let sortedWages= selectedData.sort((a,b)=>parseFloat(b["wage"]-a["wage"]));
            res.json(sortedWages);
        }else if(occSort === 'wageAsc'){
            let sortedWages= selectedData.sort((a,b)=>parseFloat(a["wage"]-b["wage"]));
            res.json(sortedWages);
        }
    }catch (error){
        console.error('Error fetching occupation data', error);
        res.status(500).json({ message: 'Error fetching specific occupation wage data from the API'});
    }
});
app.listen(4322, console.log("Server started on Port 4322"));