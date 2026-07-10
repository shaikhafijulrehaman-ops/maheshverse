const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Check environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/maheshverse';
let isMongoConnected = false;

// We will attempt to connect to MongoDB. If it fails or is not available, we use JSON DB.
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB at:', MONGODB_URI);
    // Set connection timeout to 3 seconds so it fails fast if not running
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000
    });
    isMongoConnected = true;
    console.log('MongoDB connected successfully!');
  } catch (err) {
    console.warn('MongoDB connection failed. Falling back to local JSON database storage.');
    isMongoConnected = false;
  }
};

// ----------------------------------------------------
// MONGOOSE SCHEMAS (for when MongoDB is connected)
// ----------------------------------------------------

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, default: 'admin' },
  isDisabled: { type: Boolean, default: false }
});

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  isHidden: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
});

const propertyTypeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  isEnabled: { type: Boolean, default: true }
});

const leadSchema = new mongoose.Schema({
  type: { type: String, enum: ['buy', 'sell'], required: true },
  status: { type: String, default: 'new' },
  createdAt: { type: Date, default: Date.now },
  personalInfo: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String }
  },
  buyDetails: {
    preferredLocation: String,
    propertyType: String,
    otherPropertyType: String,
    bhk: String,
    minBudget: Number,
    maxBudget: Number,
    loanRequired: String,
    readyToMove: String,
    additionalRequirements: String
  },
  sellDetails: {
    location: String,
    propertyType: String,
    otherPropertyType: String,
    constructionType: String,
    size: String,
    facing: String,
    age: String,
    expectedPrice: Number,
    images: [String],
    additionalInformation: String
  }
});

const followupSchema = new mongoose.Schema({
  leadId: { type: String, required: true },
  date: { type: Date, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  type: { type: String, default: 'info' },
  createdAt: { type: Date, default: Date.now }
});

// Create Mongoose models
const MongoUser = mongoose.model('User', userSchema);
const MongoLocation = mongoose.model('Location', locationSchema);
const MongoPropertyType = mongoose.model('PropertyType', propertyTypeSchema);
const MongoLead = mongoose.model('Lead', leadSchema);
const MongoFollowup = mongoose.model('Followup', followupSchema);
const MongoNotification = mongoose.model('Notification', notificationSchema);

// ----------------------------------------------------
// FILE-BASED DB IMPLEMENTATION (FALLBACK)
// ----------------------------------------------------

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class JsonModel {
  constructor(modelName) {
    this.filePath = path.join(DATA_DIR, `${modelName.toLowerCase()}.json`);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([]));
    }
  }

  _read() {
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return [];
    }
  }

  _write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  async find(query = {}) {
    let items = this._read();
    
    // Simple filter matching
    return items.filter(item => {
      for (let key in query) {
        // Deep checking for nested personalInfo
        if (key.includes('.')) {
          const parts = key.split('.');
          let val = item;
          for (let part of parts) {
            val = val ? val[part] : undefined;
          }
          if (val !== query[key]) return false;
        } else {
          // Normal check
          if (item[key] !== query[key]) {
            // Handle array element match, regex, or direct match
            if (query[key] instanceof RegExp) {
              if (!query[key].test(item[key])) return false;
            } else if (typeof query[key] === 'object' && query[key] !== null) {
              // Handle custom operators like $ne or $regex
              if (query[key].$ne !== undefined && item[key] === query[key].$ne) return false;
              if (query[key].$regex !== undefined) {
                const regex = new RegExp(query[key].$regex, query[key].$options || '');
                if (!regex.test(item[key])) return false;
              }
            } else if (item[key] !== query[key]) {
              return false;
            }
          }
        }
      }
      return true;
    });
  }

  async findById(id) {
    const items = this._read();
    return items.find(item => item._id === id || item.id === id) || null;
  }

  async findOne(query = {}) {
    const items = await this.find(query);
    return items.length > 0 ? items[0] : null;
  }

  async create(data) {
    const items = this._read();
    const newItem = {
      _id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...data
    };
    items.push(newItem);
    this._write(items);
    return newItem;
  }

  async findByIdAndUpdate(id, updateData, options = {}) {
    const items = this._read();
    const index = items.findIndex(item => item._id === id || item.id === id);
    if (index === -1) return null;

    // Handle mongoose-style updates (like $set or raw object)
    let finalUpdate = updateData;
    if (updateData.$set) {
      finalUpdate = updateData.$set;
    }

    // Merge nested fields if needed (like personalInfo)
    const current = items[index];
    
    // Deep merge for personalInfo
    if (finalUpdate.personalInfo && current.personalInfo) {
      finalUpdate.personalInfo = { ...current.personalInfo, ...finalUpdate.personalInfo };
    }
    if (finalUpdate.buyDetails && current.buyDetails) {
      finalUpdate.buyDetails = { ...current.buyDetails, ...finalUpdate.buyDetails };
    }
    if (finalUpdate.sellDetails && current.sellDetails) {
      finalUpdate.sellDetails = { ...current.sellDetails, ...finalUpdate.sellDetails };
    }

    items[index] = {
      ...current,
      ...finalUpdate,
      _id: current._id // Ensure ID never changes
    };

    this._write(items);
    return items[index];
  }

  async findByIdAndDelete(id) {
    const items = this._read();
    const index = items.findIndex(item => item._id === id || item.id === id);
    if (index === -1) return null;
    const deleted = items.splice(index, 1)[0];
    this._write(items);
    return deleted;
  }

  async countDocuments(query = {}) {
    const items = await this.find(query);
    return items.length;
  }
}

// ----------------------------------------------------
// DATABASE ACCESS WRAPPER
// ----------------------------------------------------

const db = {
  connect: connectDB,
  isMongo: () => isMongoConnected,
  
  User: {
    find: (q) => isMongoConnected ? MongoUser.find(q) : new JsonModel('User').find(q),
    findOne: (q) => isMongoConnected ? MongoUser.findOne(q) : new JsonModel('User').findOne(q),
    findById: (id) => isMongoConnected ? MongoUser.findById(id) : new JsonModel('User').findById(id),
    create: (data) => isMongoConnected ? MongoUser.create(data) : new JsonModel('User').create(data),
    findByIdAndUpdate: (id, data, opt) => isMongoConnected ? MongoUser.findByIdAndUpdate(id, data, { new: true, ...opt }) : new JsonModel('User').findByIdAndUpdate(id, data, opt),
    findByIdAndDelete: (id) => isMongoConnected ? MongoUser.findByIdAndDelete(id) : new JsonModel('User').findByIdAndDelete(id),
  },

  Location: {
    find: (q) => isMongoConnected ? MongoLocation.find(q) : new JsonModel('Location').find(q),
    findOne: (q) => isMongoConnected ? MongoLocation.findOne(q) : new JsonModel('Location').findOne(q),
    findById: (id) => isMongoConnected ? MongoLocation.findById(id) : new JsonModel('Location').findById(id),
    create: (data) => isMongoConnected ? MongoLocation.create(data) : new JsonModel('Location').create(data),
    findByIdAndUpdate: (id, data, opt) => isMongoConnected ? MongoLocation.findByIdAndUpdate(id, data, { new: true, ...opt }) : new JsonModel('Location').findByIdAndUpdate(id, data, opt),
    findByIdAndDelete: (id) => isMongoConnected ? MongoLocation.findByIdAndDelete(id) : new JsonModel('Location').findByIdAndDelete(id),
  },

  PropertyType: {
    find: (q) => isMongoConnected ? MongoPropertyType.find(q) : new JsonModel('PropertyType').find(q),
    findOne: (q) => isMongoConnected ? MongoPropertyType.findOne(q) : new JsonModel('PropertyType').findOne(q),
    findById: (id) => isMongoConnected ? MongoPropertyType.findById(id) : new JsonModel('PropertyType').findById(id),
    create: (data) => isMongoConnected ? MongoPropertyType.create(data) : new JsonModel('PropertyType').create(data),
    findByIdAndUpdate: (id, data, opt) => isMongoConnected ? MongoPropertyType.findByIdAndUpdate(id, data, { new: true, ...opt }) : new JsonModel('PropertyType').findByIdAndUpdate(id, data, opt),
    findByIdAndDelete: (id) => isMongoConnected ? MongoPropertyType.findByIdAndDelete(id) : new JsonModel('PropertyType').findByIdAndDelete(id),
  },

  Lead: {
    find: (q) => isMongoConnected ? MongoLead.find(q).sort({ createdAt: -1 }) : new JsonModel('Lead').find(q).then(items => items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))),
    findOne: (q) => isMongoConnected ? MongoLead.findOne(q) : new JsonModel('Lead').findOne(q),
    findById: (id) => isMongoConnected ? MongoLead.findById(id) : new JsonModel('Lead').findById(id),
    create: (data) => isMongoConnected ? MongoLead.create(data) : new JsonModel('Lead').create(data),
    findByIdAndUpdate: (id, data, opt) => isMongoConnected ? MongoLead.findByIdAndUpdate(id, data, { new: true, ...opt }) : new JsonModel('Lead').findByIdAndUpdate(id, data, opt),
    findByIdAndDelete: (id) => isMongoConnected ? MongoLead.findByIdAndDelete(id) : new JsonModel('Lead').findByIdAndDelete(id),
    countDocuments: (q) => isMongoConnected ? MongoLead.countDocuments(q) : new JsonModel('Lead').countDocuments(q)
  },

  Followup: {
    find: (q) => isMongoConnected ? MongoFollowup.find(q).sort({ date: 1 }) : new JsonModel('Followup').find(q).then(items => items.sort((a, b) => new Date(a.date) - new Date(b.date))),
    findOne: (q) => isMongoConnected ? MongoFollowup.findOne(q) : new JsonModel('Followup').findOne(q),
    findById: (id) => isMongoConnected ? MongoFollowup.findById(id) : new JsonModel('Followup').findById(id),
    create: (data) => isMongoConnected ? MongoFollowup.create(data) : new JsonModel('Followup').create(data),
    findByIdAndUpdate: (id, data, opt) => isMongoConnected ? MongoFollowup.findByIdAndUpdate(id, data, { new: true, ...opt }) : new JsonModel('Followup').findByIdAndUpdate(id, data, opt),
    findByIdAndDelete: (id) => isMongoConnected ? MongoFollowup.findByIdAndDelete(id) : new JsonModel('Followup').findByIdAndDelete(id),
  },

  Notification: {
    find: (q) => isMongoConnected ? MongoNotification.find(q).sort({ createdAt: -1 }) : new JsonModel('Notification').find(q).then(items => items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))),
    findOne: (q) => isMongoConnected ? MongoNotification.findOne(q) : new JsonModel('Notification').findOne(q),
    findById: (id) => isMongoConnected ? MongoNotification.findById(id) : new JsonModel('Notification').findById(id),
    create: (data) => isMongoConnected ? MongoNotification.create(data) : new JsonModel('Notification').create(data),
    findByIdAndUpdate: (id, data, opt) => isMongoConnected ? MongoNotification.findByIdAndUpdate(id, data, { new: true, ...opt }) : new JsonModel('Notification').findByIdAndUpdate(id, data, opt),
    findByIdAndDelete: (id) => isMongoConnected ? MongoNotification.findByIdAndDelete(id) : new JsonModel('Notification').findByIdAndDelete(id),
  }
};

module.exports = db;
