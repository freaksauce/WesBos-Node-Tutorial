const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');
const striptags = require('striptags');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a Store name!'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates!'
    }],
    address: {
      type: String,
      required: 'You must supply an address!'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  }
}, {
  toJSON: {virtuals: true},
  toObject: {virtuals: true}
});

// define indexes
storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({
  location: '2dsphere'
})

storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    next(); // skip it
    return;
  }
  this.name = striptags(this.name);
  this.slug = slug(this.name);
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({slug: slugRegEx});
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }

  next();
  // TODO make slugs unique
})

storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    {$unwind: '$tags'},
    {$group: {_id: '$tags', count: {$sum: 1}}},
    {$sort: {count: -1}}
  ]);
}

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // lookup stores and populate their  reviews
    {$lookup: {
      from: 'reviews',
      localField: '_id',
      foreignField: 'store',
      as: 'reviews'
      }
    },
    // filter for items that have only 2 or more reviews
    {$match: {
      'reviews.1': {$exists: true}
    }},
    // add the average reviews field
    {$addFields: {
      averageRating: {$avg: '$reviews.rating'}
    }},
    // sort it by our new field, highest reviews first
    {$sort: {
      averageRating: -1
    }},
    // limimt to at most 10
    {$limit: 10}
  ]);
}

// find reviews where the stores._id === reviews store property
storeSchema.virtual('reviews', {
  ref: 'Review', // which model
  localField: '_id', // which field on store
  foreignField: 'store' // which field on review
});

function autoPopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autoPopulate);
storeSchema.pre('findOne', autoPopulate);

module.exports = mongoose.model('Store', storeSchema);
