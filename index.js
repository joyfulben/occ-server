import express from "express";
const app = express();
import cors from "cors";
import axios from "axios";

app.use(cors({ origin: 'http://localhost:3000' }));

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
        res.json({total_occupations:occArray.length, occupations: occArray});
    } catch (error) {
      // Handle any errors
      console.error('Error fetching data:', error);
      res.status(500).json({ message: 'Error fetching data from the API' });
    }
  });
app.get('/occupations', async (req, res) => {
    try{
        // Get the id and sort query params and create an array for selected data
        const occId = req.query.id;
        const occSort = req.query.sort;
        let selectedData = [];
        const statesArr = [];
        const wagesArr = [];
        // Make separate arrays for the list of states and their wages. This is for chart.js 
        function formatArrays (){
            selectedData.forEach(el=>{
                statesArr.push(el.state);
                wagesArr.push(el.wage);
            });
        }
        //API URL
        const occWagesData = `http://datausa.io/api/data?drilldowns=Year,State&measures=Average Wage,Average Wage Appx MOE&Record Count>=5&Workforce Status=true&Detailed Occupation=${occId}`;
        //Fetch data
        const response = await axios.get(occWagesData);
        const responseArr = response.data.data;
        responseArr.forEach(occupation => {
            if (occupation["Year"]==="2022"){
                const aveWage = occupation["Average Wage"]? parseFloat(occupation["Average Wage"]).toFixed(2): "0.00";
                const wageMOE = occupation["Average Wage Appx MOE"]? parseFloat(occupation["Average Wage Appx MOE"]).toFixed(2): "0.00";
                selectedData.push({state:occupation["State"],wage:aveWage,wageMOE:wageMOE});
            }
        });
        if (occSort === 'alpha'){
            formatArrays();
            const stateWageArrays = {
                wages: wagesArr,
                states: statesArr
            }
            res.json(stateWageArrays);
        }else if(occSort === 'wageDes'){
            console.log('state of selected data: ',selectedData);
            selectedData= selectedData.sort((a,b)=>parseFloat(b["wage"]-a["wage"]));
            formatArrays();
            const stateWageArrays = {
                wages: wagesArr,
                states: statesArr
            }
            res.json(stateWageArrays);
        }else if(occSort === 'wageAsc'){
            selectedData= selectedData.sort((a,b)=>parseFloat(a["wage"]-b["wage"]));
            formatArrays();
            const stateWageArrays = {
                wages: wagesArr,
                states: statesArr
            }
            res.json(stateWageArrays);
        }
    }catch (error){
        console.error('Error fetching occupation data', error);
        res.status(500).json({ message: 'Error fetching specific occupation wage data from the API'});
    }
});
app.listen(4322, console.log("Server started on Port 4322"));