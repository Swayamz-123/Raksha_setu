import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import { User } from '../src/models/user.model.js';
import { Ambulance } from '../src/models/ambulance.model.js';
import { Hospital } from '../src/models/hospital.model.js';
import { Resource } from '../src/models/resource.model.js';
import { updateUserLocation } from '../src/services/locationService.js';
import { USER_ROLES, SKILL_TYPES, AMBULANCE_STATUS } from '../src/constant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/raksha-setu';

// Central Anchor: New Delhi (Connaught Place / AIIMS area)
const SAMPLE_HOSPITALS = [
  {
    name: 'All India Institute of Medical Sciences (AIIMS)',
    coordinates: [77.2090, 28.5672], // [lng, lat]
    address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi',
    phone: '011-26588500',
    emergency: 'yes',
    operator: 'Government',
    verified: true
  },
  {
    name: 'Safdarjung Hospital & Trauma Centre',
    coordinates: [77.2075, 28.5695],
    address: 'Ring Road, Opposite AIIMS, New Delhi',
    phone: '011-26165060',
    emergency: 'yes',
    operator: 'Government',
    verified: true
  },
  {
    name: 'Dr. Ram Manohar Lohia Hospital (RML)',
    coordinates: [77.2014, 28.6253],
    address: 'Baba Kharak Singh Marg, Connaught Place, New Delhi',
    phone: '011-23365525',
    emergency: 'yes',
    operator: 'Government',
    verified: true
  },
  {
    name: 'Max Super Speciality Hospital, Saket',
    coordinates: [77.2132, 28.5284],
    address: '1, 2, Press Enclave Marg, Saket, New Delhi',
    phone: '011-26515050',
    emergency: 'yes',
    operator: 'Private',
    verified: true
  },
  {
    name: 'Fortis Escorts Heart Institute',
    coordinates: [77.2783, 28.5604],
    address: 'Okhla Road, Sukhdev Vihar, New Delhi',
    phone: '011-47135000',
    emergency: 'yes',
    operator: 'Private',
    verified: true
  },
  {
    name: 'Indraprastha Apollo Hospital',
    coordinates: [77.2831, 28.5402],
    address: 'Delhi-Mathura Road, Sarita Vihar, New Delhi',
    phone: '011-71791090',
    emergency: 'yes',
    operator: 'Private',
    verified: true
  }
];

const SAMPLE_AMBULANCES = [
  { name: 'City Trauma Ambulance Alpha', vehicleNumber: 'DL-01-EM-1081', phone: '+91 98100 11081', coordinates: [77.2150, 28.5650] },
  { name: 'Red Cross Quick Response 02', vehicleNumber: 'DL-01-EM-1082', phone: '+91 98100 11082', coordinates: [77.2050, 28.6200] },
  { name: 'Max Emergency Mobile ICU 03', vehicleNumber: 'DL-02-EM-2083', phone: '+91 98100 11083', coordinates: [77.2180, 28.5310] },
  { name: 'Apollo Advanced Cardiac Care', vehicleNumber: 'DL-03-EM-3084', phone: '+91 98100 11084', coordinates: [77.2800, 28.5450] },
  { name: 'Community Rapid Responder 05', vehicleNumber: 'DL-04-EM-4085', phone: '+91 98100 11085', coordinates: [77.2250, 28.6100] }
];

const SAMPLE_RESOURCES = [
  { name: 'Connaught Place Police Station', type: 'police_station', coordinates: [77.2185, 28.6315], address: 'Palika Bazar, CP, New Delhi', verified: true },
  { name: 'Delhi Fire Service Headquarters', type: 'fire_station', coordinates: [77.2241, 28.6291], address: 'Barakhamba Road, Connaught Place, New Delhi', verified: true },
  { name: 'Public Automated External Defibrillator (AED)', type: 'aed', coordinates: [77.2085, 28.5670], address: 'AIIMS Metro Station Concourse', verified: true },
  { name: 'Metro Station Emergency Extinguisher Depot', type: 'fire_extinguisher', coordinates: [77.2010, 28.6250], address: 'Shivaji Stadium Metro Station Gate 2', verified: true }
];

const SAMPLE_RESPONDERS = [
  {
    name: 'Dr. Aarav Sharma',
    email: 'aarav.responder@rakshasetu.org',
    password: 'Password@123',
    phone: '+91 98765 43210',
    role: USER_ROLES.USER,
    trustScore: 0.98,
    skills: [
      { type: SKILL_TYPES.CPR, verified: true },
      { type: SKILL_TYPES.FIRST_AID, verified: true },
      { type: SKILL_TYPES.MEDICAL_PROFESSIONAL, verified: true }
    ],
    coordinates: [77.2100, 28.5680] // Near AIIMS
  },
  {
    name: 'Priya Verma (Paramedic)',
    email: 'priya.responder@rakshasetu.org',
    password: 'Password@123',
    phone: '+91 98765 43211',
    role: USER_ROLES.USER,
    trustScore: 0.95,
    skills: [
      { type: SKILL_TYPES.CPR, verified: true },
      { type: SKILL_TYPES.FIRST_AID, verified: true }
    ],
    coordinates: [77.2060, 28.5710] // Near Safdarjung
  },
  {
    name: 'Rohan Mehta (Fire Safety Officer)',
    email: 'rohan.responder@rakshasetu.org',
    password: 'Password@123',
    phone: '+91 98765 43212',
    role: USER_ROLES.USER,
    trustScore: 0.92,
    skills: [
      { type: SKILL_TYPES.FIRE_SAFETY, verified: true },
      { type: SKILL_TYPES.FIRST_AID, verified: true }
    ],
    coordinates: [77.2230, 28.6280] // Near CP Fire station
  },
  {
    name: 'Kavita Singh (Campus Security)',
    email: 'kavita.responder@rakshasetu.org',
    password: 'Password@123',
    phone: '+91 98765 43213',
    role: USER_ROLES.USER,
    trustScore: 0.89,
    skills: [
      { type: SKILL_TYPES.SECURITY, verified: true },
      { type: SKILL_TYPES.FIRST_AID, verified: true }
    ],
    coordinates: [77.2020, 28.6240] // Near RML
  }
];

async function seedDatabase() {
  console.log('===========================================================');
  console.log('       RakshaSetu Automated Database Seeding Engine         ');
  console.log('===========================================================');
  console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    // Clean up any legacy non-sparse index
    try {
      await User.collection.dropIndex('emergencyCardToken_1');
    } catch {}

    // 1. Seed or Update Admin Account
    console.log('[1/5] Seeding System Admin Account...');
    let admin = await User.findOne({ email: 'admin@rakshasetu.org' });
    if (!admin) {
      admin = await User.create({
        name: 'RakshaSetu System Admin',
        email: 'admin@rakshasetu.org',
        password: 'AdminPassword@123',
        phone: '+91 99999 00000',
        role: USER_ROLES.ADMIN,
        trustScore: 1.0,
        medicalHistory: { bloodType: 'O+' }
      });
      console.log('  -> Admin created: admin@rakshasetu.org / AdminPassword@123');
    } else {
      console.log('  -> Admin already exists: admin@rakshasetu.org');
    }

    // 2. Seed Verified Responders and Index in Redis Geospatial
    console.log('\n[2/5] Seeding Verified Community Responders & Redis Coordinates...');
    const seededResponders = [];
    for (const rData of SAMPLE_RESPONDERS) {
      let responder = await User.findOne({ email: rData.email });
      if (!responder) {
        responder = await User.create({
          name: rData.name,
          email: rData.email,
          password: rData.password,
          phone: rData.phone,
          role: rData.role,
          trustScore: rData.trustScore,
          skills: rData.skills,
          isActive: true
        });
      }
      seededResponders.push(responder);

      // Register live location in Redis Geospatial index
      await updateUserLocation(responder._id, rData.coordinates[0], rData.coordinates[1]);
      console.log(`  -> Responder active: ${responder.name} (Live GPS: [${rData.coordinates.join(', ')}])`);
    }

    // 3. Seed Ambulances
    console.log('\n[3/5] Seeding Emergency Ambulances...');
    for (const amb of SAMPLE_AMBULANCES) {
      await Ambulance.findOneAndUpdate(
        { vehicleNumber: amb.vehicleNumber },
        {
          name: amb.name,
          vehicleNumber: amb.vehicleNumber,
          phone: amb.phone,
          status: AMBULANCE_STATUS.AVAILABLE,
          isAvailable: true,
          location: { type: 'Point', coordinates: amb.coordinates },
          addedBy: admin._id
        },
        { upsert: true, new: true }
      );
      console.log(`  -> Ambulance ready: ${amb.name} [${amb.vehicleNumber}]`);
    }

    // 4. Seed Major Hospitals
    console.log('\n[4/5] Seeding Multi-Specialty Hospitals & Trauma Centers...');
    for (const hosp of SAMPLE_HOSPITALS) {
      await Hospital.findOneAndUpdate(
        { name: hosp.name },
        {
          name: hosp.name,
          location: { type: 'Point', coordinates: hosp.coordinates },
          address: hosp.address,
          phone: hosp.phone,
          emergency: hosp.emergency,
          operator: hosp.operator,
          verified: true,
          addedBy: admin._id
        },
        { upsert: true, new: true }
      );
      console.log(`  -> Hospital indexed: ${hosp.name}`);
    }

    // 5. Seed Static Emergency POIs
    console.log('\n[5/5] Seeding Critical Safety Resources (AEDs, Police, Fire)...');
    for (const res of SAMPLE_RESOURCES) {
      await Resource.findOneAndUpdate(
        { name: res.name },
        {
          name: res.name,
          type: res.type,
          location: { type: 'Point', coordinates: res.coordinates },
          address: res.address,
          verified: true,
          addedBy: admin._id
        },
        { upsert: true, new: true }
      );
      console.log(`  -> Resource indexed: ${res.name} (${res.type})`);
    }

    console.log('\n===========================================================');
    console.log('   Database & Redis Seed Complete: Platform Live & Demo Ready! ');
    console.log('   Admin Login:     admin@rakshasetu.org / AdminPassword@123');
    console.log('   Live Responders: 4 Active CPR/First-Aid units in Redis Geo');
    console.log('   Ambulances:      5 Available units with route tracking');
    console.log('   Hospitals:       6 Trauma centers with 2dsphere indexes');
    console.log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seedDatabase();
