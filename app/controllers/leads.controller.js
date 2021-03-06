const db = require("../models");
const fs = require("fs");
const csv = require("fast-csv");
const { Parser } = require('json2csv');
const logger = require("../config/winston");
const Leads = db.leads;
const Op = db.Sequelize.Op;
const getPagingData = (data, page, limit) => {
    const { count: leadsCount, rows: leadsData } = data;
    const currentPage = page ? page : 1;
    const totalPages = Math.ceil(leadsCount / limit);
    return { leadsCount, leadsData, totalPages, currentPage };
  };

const getPagination = (page, size) => {
    const limit = size ? size : 5;
    const offset = page ? page * limit : 0;
    return { limit, offset };
  };
const  isEmailUnique = async (email)=> {
    const count = await Leads.count({ where: { email: email } })
        if (count != 0) {
          logger.info(count);
          return false;
        }
        return true;
}
// const jsontocsv = async (duplicates)=>{
//   var fields = ['id','title','firstName','lastName','email','assignee','leadStatus','leadSource','leadRating','phone','companyName','industry','adressLine1','adressLine2','city','state','country','zipcode','createdAt','createdAt'];
//   var csv =  json2csv.parse({ data: duplicates, fields: fields });
//   var filename = 'duplicates'+Date.now()+'.csv';
//   var path = __basedir+'/assets/reports/'+filename;
//   logger.info("file path jsontocsv",path)
//    fs.writeFile(path, csv, function(err,data) {
//     if (err) {throw err;}
//     else{ 
//       logger.info('file saved path generated') // This is what you need
//       return filename;
//     }
//   }); 
// }
const leadController = {
    add : async (req, res) => {
        const reqData = req.body;
        const {email} = reqData;
          try {
          
            const data = await Leads.findOne({where:{email}}); 
            logger.info(data); 
            if(data){
              logger.warn("Conflicting data .....!")
              res.status(409).json({msg:"conflict already exist with this email"});

            }
          }catch (error) {
            logger.info(error);
            res.status(404).send({msg :error});
          }
        Leads.create(reqData)
             .then((data)=>{
              logger.info("saved successfully");
              res.status(201).json({msg:"saved successfully",data})

             })
             .catch((err)=>{
               logger.info("err : " +  err.message);
               res.status(500).send("Internal server error");
             });
    },
    getData : (req, res) => {
        const id = req.params.id;
        if(!id){
          logger.info("Id entered does not exist")
          res.status(401).send({message:"Please enter valid id"});

        }
        Leads.findOne({where:  {id}})
          .then(data =>{
            if(!data){
              logger.info("Wrong Id entered does not exist")
              res.status(404).send({msg:"No data available"});
            }
            logger.info("data recieved successfully "+data)
            res.status(201).json({msg:"data recieved successfully",data});

          }).catch(err => {
            logger.info("Some error occurred while retrieving"+ err.message)
            res.status(500).send({
                message:
                err.message || "Some error occurred while retrieving"
            });
            
        });
    },
    getAll: (req,res)=>{
        const { page, size, title } = req.query;
        var condition = title ? { title: { [Op.like]: `%${title}%` } } : null;
        const { limit, offset } = getPagination(page, size);
        Leads.findAndCountAll({ where: condition ? condition:"", limit, offset })
            .then(data => {         
                const lData = getPagingData(data, page, limit);
                res.status(201).json(lData);
                logger.info("data recieved successfully ",data)
                })
                .catch(err => {
                logger.info("Some error occurred while retrieving")
                res.status(500).send({
                    message:
                    err.message || "Some error occurred while retrieving Leads."
                });
                
       });
    },
    upload : (req, res) => {
          var duplicates = [];
          let leads = [];
          var err;
          try  {
            if (req.file == undefined) {
              logger.info("No file attached please select a file")
              return res.status(400).send("Please upload a CSV file!");
            }
            let path = __basedir + "/assets/uploads/" + req.file.filename;
            
            fs.createReadStream(path)
              .pipe(csv.parse({ headers: true }))
              .on("error", (error) => {
                logger.info("Unable to save file :"+error.message)
                throw error.message;
                
              })
              .on("data", (row) => {                  
                leads.push(row);
              })
              .on("end",() => {
                logger.info("data read successfully now updating in data base");
                var emails = leads.map(obj => (obj.email));
                logger.info("emails to be updated : => ", emails)
                Leads.findAll({
                  where:{
                    email:emails
                  }
                }).then((result)=>{
                  var duplicateData = result.map((data)=> data.dataValues)
                  logger.info("duplicates data",duplicateData);

                duplicates = result.map((data)=> data.dataValues.email);
                logger.info("duplicates ",duplicates);
                var leadtobeupdated = leads.filter(lead => {
                  if(duplicates.indexOf(lead.email) == -1)
                   return lead;
                });
                logger.info("lead to length ",leadtobeupdated.length);
                logger.info("to be updated ",JSON.stringify(leadtobeupdated));
                if(duplicates.length == 0 || duplicates.length != leads.length){
                  if(leadtobeupdated){
                    Leads.bulkCreate(leadtobeupdated,{ignoreDuplicates:true}).then((result)=>{
                      if(duplicates.length == 0){
                        logger.info("data read successfully now updated  in database No duplicate were there");
                        res.status(201).send({
                          message:
                            "Uploaded successfully All data from" + req.file.originalname,
                            data:result
                        });
                      }else{
                        logger.info("data read successfully now updated  in database and duplicate were there also");
                        logger.info("Else duplicate data",duplicateData);
                        var fields = ['id','title','firstName','lastName','email','assignee','leadStatus','leadSource','leadRating','phone','companyName','industry','adressLine1','adressLine2','city','state','country','zipcode','createdAt','createdAt'];
                        const parser = new Parser({fields});
                        var csv =  parser.parse(duplicateData);
                        var filename = 'duplicates'+Date.now()+'.csv';
                        var path = __basedir+'/assets/reports/'+filename;
                        logger.info("file path jsontocsv",path)
                         fs.writeFile(path, csv, function(err,data) {
                          if (err) {throw err;}
                          else{ 
                            logger.info('file saved path generated') // This is what you need
                          }
                        }); 
                        logger.info("data generated and send the path to client")
                        res.status(409).json({
                          message:
                          `Partialy  data saved  duplicate are here `,
                          "created": leads.length - duplicates.length,
                          "duplicates": duplicates.length,
                          "error": err==undefined?0:err,
                          "report": `${__baseurl}/api/leads/download/${filename}`
                        });
                      }
                   }); 
                  }
                }else{
                  logger.info(duplicates);
                  var fields = ['id','title','firstName','lastName','email','assignee','leadStatus','leadSource','leadRating','phone','companyName','industry','adressLine1','adressLine2','city','state','country','zipcode','createdAt','createdAt'];
                  const parser = new Parser({fields});
                  var csv =  parser.parse(duplicateData);
                  var filename = 'duplicates'+Date.now()+'.csv';
                  var path = __basedir+'/assets/reports/'+filename;
                  logger.info("file path jsontocsv",path)
                   fs.writeFile(path, csv, function(err,data) {
                    if (err) {throw err;}
                    else{ 
                      logger.info('file saved path generated') // This is what you need
                    }
                  }); 
                  logger.info("data read successfully All data were duplicate so no change in database");
                  res.status(409).json({
                     message:
                     `All  data are  duplicate No data saved `,
                     "created": leads.length - duplicates.length,
                     "duplicates": duplicates.length,
                     "error": err==undefined ? 0 : err,
                     "report": `${__baseurl}/api/leads/download/${filename}`
                  });
                }
              }).catch(err =>{
                logger.info("Internal Server Error " +err.message);
                res.status(500).json({
                  message:
                  `Internal server issue ${err.message} `,
               });
              });
            });
          } catch (error) {
            logger.info(error);
            res.status(500).json({
              message:
              `Internal server issue ${error.message} `,
           });
        }
    },
    update: (req,res)=>{
          const id = req.params.id;
          if(!id){
            logger.info("Invalid entered");
            res.status(401).send({message:"Please enter valid id"})
          }
          Leads.findOne({where: {id}})
                .then(record => {

                  if (!record) {
                    logger.info("No record found with this id:"+id);
                    throw new Error('No record found')
                  }

                  logger.info(`retrieved record ${JSON.stringify(record,null,2)}`) 
                  let reqData = req.body;
                  record.update(reqData).then( updatedRecord => {
                    logger.info(`updated record ${JSON.stringify(updatedRecord,null,2)}`)
                    res.status(201).json({msg:"successfully updated",data:updatedRecord});
                  })
                })
                .catch((error) => {
                  logger.info("Internal Server Error " +error.message);
                  res.status(500).send({msg:"Internal Server Error"+error.message});
                  throw new Error(error)
                });
    },
    bupdate:(req,res)=>{
              const ids = req.body.ids;
              const data = req.body.data
              Leads.update(data,
                {where: {
                    id: ids
                  }},
              ).then((result)=>{
                   logger.info(result);
                   res.status(201).send({msg:"successfully updated",data:result});
              }).catch((err)=>{
                    logger.info("Internal Server Error " +err.message);
                    res.status(500).send({msg:"Internal Server Error"+err.message});
                    throw new Error(err.message);
              });
    },
    delete : (req,res)=>{
            const id = req.params.id;
            if(!id){
              logger.info("Id is empty please add valid id : "+id);
              res.status(401).send({message:"Please enter valid id"})
            }
            Leads.destroy({
              where: {id}
            }).then(result => {
              if(result!=0){
                logger.info("succssfull deleted data related with id : "+id);
                res.status(201).send({msg:`succssfull deleted data`});
              }else{
                logger.info("Data does not exist with this inf : "+id);
                res.status(201).send({msg:"Data does not exist with this info !"});
              }

            }).catch(error => {
              logger.info("Internal Server error : "+id);
              res.status(500).send({msg:`Internal Server error`});
            });
    },
    download:(req,res)=>{
     var fname =req.params.filename;
     var path = __basedir+"/assets/reports/"+fname; 
     logger.info(" downloaded file duplicates",path)
     res.set('Content-Type', 'text/csv');
     res.status(201).download(path);
    },
}
module.exports = leadController