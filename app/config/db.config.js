module.exports = {
    // HOST: "postgres", fordocker
    HOST: "localhost",
    USER: "postgres",
    PASSWORD: "postgres",
    DB: "crmleads",
    dialect: "postgres",
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  };