/**
 * Bootstrap Script for IPL Auction System
 * Sets up initial data, admin user, and sample season
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

// Sample player data for IPL 2024
const samplePlayers = [
  // Indian Batsmen
  { name: 'Virat Kohli', country: 'India', role: 'BATSMAN', basePrice: 15000000, isOverseas: false },
  { name: 'Rohit Sharma', country: 'India', role: 'BATSMAN', basePrice: 14000000, isOverseas: false },
  { name: 'KL Rahul', country: 'India', role: 'WICKET_KEEPER', basePrice: 12000000, isOverseas: false },
  { name: 'Shikhar Dhawan', country: 'India', role: 'BATSMAN', basePrice: 8000000, isOverseas: false },
  { name: 'Rishabh Pant', country: 'India', role: 'WICKET_KEEPER', basePrice: 16000000, isOverseas: false },
  
  // Indian Bowlers
  { name: 'Jasprit Bumrah', country: 'India', role: 'BOWLER', basePrice: 18000000, isOverseas: false },
  { name: 'Mohammed Shami', country: 'India', role: 'BOWLER', basePrice: 10000000, isOverseas: false },
  { name: 'Yuzvendra Chahal', country: 'India', role: 'BOWLER', basePrice: 8000000, isOverseas: false },
  { name: 'Ravindra Jadeja', country: 'India', role: 'ALL_ROUNDER', basePrice: 15000000, isOverseas: false },
  { name: 'Hardik Pandya', country: 'India', role: 'ALL_ROUNDER', basePrice: 17000000, isOverseas: false },
  
  // Overseas Players
  { name: 'AB de Villiers', country: 'South Africa', role: 'BATSMAN', basePrice: 11000000, isOverseas: true },
  { name: 'David Warner', country: 'Australia', role: 'BATSMAN', basePrice: 10000000, isOverseas: true },
  { name: 'Kane Williamson', country: 'New Zealand', role: 'BATSMAN', basePrice: 9000000, isOverseas: true },
  { name: 'Jos Buttler', country: 'England', role: 'WICKET_KEEPER', basePrice: 9000000, isOverseas: true },
  { name: 'Ben Stokes', country: 'England', role: 'ALL_ROUNDER', basePrice: 16000000, isOverseas: true },
  { name: 'Kagiso Rabada', country: 'South Africa', role: 'BOWLER', basePrice: 9000000, isOverseas: true },
  { name: 'Trent Boult', country: 'New Zealand', role: 'BOWLER', basePrice: 8000000, isOverseas: true },
  { name: 'Andre Russell', country: 'West Indies', role: 'ALL_ROUNDER', basePrice: 12000000, isOverseas: true },
  { name: 'Rashid Khan', country: 'Afghanistan', role: 'BOWLER', basePrice: 10000000, isOverseas: true },
  { name: 'Chris Gayle', country: 'West Indies', role: 'BATSMAN', basePrice: 7000000, isOverseas: true },
  
  // More Indian players
  { name: 'Ajinkya Rahane', country: 'India', role: 'BATSMAN', basePrice: 5000000, isOverseas: false },
  { name: 'Cheteshwar Pujara', country: 'India', role: 'BATSMAN', basePrice: 4000000, isOverseas: false },
  { name: 'Washington Sundar', country: 'India', role: 'ALL_ROUNDER', basePrice: 6000000, isOverseas: false },
  { name: 'Shardul Thakur', country: 'India', role: 'ALL_ROUNDER', basePrice: 7000000, isOverseas: false },
  { name: 'Bhuvneshwar Kumar', country: 'India', role: 'BOWLER', basePrice: 8000000, isOverseas: false },
]

// Sample teams data
const sampleTeams = [
  { name: 'Mumbai Indians', displayName: 'MI', budgetTotal: 100000000 },
  { name: 'Chennai Super Kings', displayName: 'CSK', budgetTotal: 100000000 },
  { name: 'Royal Challengers Bangalore', displayName: 'RCB', budgetTotal: 100000000 },
  { name: 'Delhi Capitals', displayName: 'DC', budgetTotal: 100000000 },
  { name: 'Kolkata Knight Riders', displayName: 'KKR', budgetTotal: 100000000 },
  { name: 'Rajasthan Royals', displayName: 'RR', budgetTotal: 100000000 },
  { name: 'Punjab Kings', displayName: 'PBKS', budgetTotal: 100000000 },
  { name: 'Sunrisers Hyderabad', displayName: 'SRH', budgetTotal: 100000000 },
]

async function createAdminUser() {
  console.log('🔐 Creating admin user...')
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@iplauction.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  
  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  })
  
  if (existingAdmin) {
    console.log('✅ Admin user already exists:', existingAdmin.email)
    return existingAdmin
  }
  
  const passwordHash = await bcrypt.hash(adminPassword, 12)
  
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      name: 'System Administrator',
      role: 'ADMIN'
    }
  })
  
  console.log('✅ Admin user created:', admin.email)
  console.log('🔑 Password:', adminPassword)
  return admin
}

async function createSampleSeason() {
  console.log('🏏 Creating sample season...')
  
  // Check if season already exists
  const existingSeason = await prisma.season.findFirst({
    where: { name: 'IPL 2024', year: 2024 }
  })
  
  if (existingSeason) {
    console.log('✅ Sample season already exists')
    return existingSeason
  }
  
  const seasonSettings = {
    maxTeams: 8,
    maxBudget: 100000000, // 10 Cr
    maxSquadSize: 25,
    maxOverseasPlayers: 8,
    minWicketKeepers: 2,
    auctionRules: {
      defaultLotDuration: 30000, // 30 seconds
      softCloseThreshold: 5000, // 5 seconds
      softCloseExtension: 10000, // 10 seconds
      maxExtensions: 3,
      incrementBands: [
        { min: 0, max: 2000000, step: 100000 }, // Up to 2Cr: 10L steps
        { min: 2000000, max: 10000000, step: 250000 }, // 2-10Cr: 25L steps
        { min: 10000000, max: 50000000, step: 1000000 }, // 10-50Cr: 1Cr steps
        { min: 50000000, max: 200000000, step: 2500000 } // 50+Cr: 2.5Cr steps
      ]
    }
  }
  
  const season = await prisma.season.create({
    data: {
      name: 'IPL 2024',
      year: 2024,
      description: 'Indian Premier League 2024 - Demo Season',
      status: 'ACTIVE',
      startDate: new Date('2024-03-15'),
      endDate: new Date('2024-06-15'),
      settings: JSON.stringify(seasonSettings)
    }
  })
  
  console.log('✅ Sample season created:', season.name)
  return season
}

async function createSampleTeams(seasonId) {
  console.log('👥 Creating sample teams...')
  
  const createdTeams = []
  
  for (const teamData of sampleTeams) {
    // Check if team already exists
    const existingTeam = await prisma.team.findFirst({
      where: { 
        name: teamData.name,
        seasonId 
      }
    })
    
    if (existingTeam) {
      console.log(`   ✅ Team already exists: ${teamData.name}`)
      createdTeams.push(existingTeam)
      continue
    }
    
    const team = await prisma.team.create({
      data: {
        name: teamData.name,
        displayName: teamData.displayName,
        budgetTotal: teamData.budgetTotal,
        seasonId
      }
    })
    
    // Create initial budget transaction
    await prisma.budgetTransaction.create({
      data: {
        teamId: team.id,
        amount: teamData.budgetTotal,
        type: 'INITIAL_BUDGET',
        description: 'Initial team budget allocation'
      }
    })
    
    console.log(`   ✅ Created team: ${team.name}`)
    createdTeams.push(team)
  }
  
  console.log(`✅ Created ${createdTeams.length} teams`)
  return createdTeams
}

async function createSamplePlayers(seasonId) {
  console.log('🏃 Creating sample players...')
  
  let createdCount = 0
  
  for (const playerData of samplePlayers) {
    // Check if player already exists
    const existingPlayer = await prisma.player.findFirst({
      where: {
        name: playerData.name,
        country: playerData.country,
        seasonId
      }
    })
    
    if (existingPlayer) {
      continue
    }
    
    // Add sample stats for demonstration
    const stats = {
      matches: Math.floor(Math.random() * 200) + 50,
      runs: playerData.role === 'BOWLER' ? Math.floor(Math.random() * 1000) : Math.floor(Math.random() * 5000) + 1000,
      wickets: playerData.role === 'BATSMAN' ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 150) + 20,
      average: playerData.role === 'BOWLER' ? (Math.random() * 15 + 20).toFixed(2) : (Math.random() * 20 + 25).toFixed(2),
      strikeRate: playerData.role === 'BOWLER' ? null : (Math.random() * 50 + 120).toFixed(2),
      economy: playerData.role === 'BATSMAN' ? null : (Math.random() * 3 + 6).toFixed(2)
    }
    
    await prisma.player.create({
      data: {
        name: playerData.name,
        country: playerData.country,
        role: playerData.role,
        basePrice: playerData.basePrice,
        isOverseas: playerData.isOverseas,
        seasonId,
        stats: JSON.stringify(stats),
        tags: `${playerData.role.toLowerCase()},${playerData.country.toLowerCase()}`
      }
    })
    
    createdCount++
  }
  
  console.log(`✅ Created ${createdCount} players`)
}

async function createSampleTeamUsers(teams) {
  console.log('👤 Creating sample team users...')
  
  let createdCount = 0
  
  for (const team of teams) {
    const email = `${team.displayName.toLowerCase()}@iplauction.com`
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      continue
    }
    
    const password = 'team123' // Default password for demo
    const passwordHash = await bcrypt.hash(password, 12)
    
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: `${team.name} Manager`,
        role: 'TEAM',
        teamId: team.id
      }
    })
    
    console.log(`   ✅ Created user: ${email} (password: ${password})`)
    createdCount++
  }
  
  console.log(`✅ Created ${createdCount} team users`)
}

async function createSampleAuction(seasonId) {
  console.log('🎯 Creating sample auction...')
  
  // Check if auction already exists
  const existingAuction = await prisma.auction.findFirst({
    where: {
      seasonId,
      name: 'IPL 2024 Player Auction'
    }
  })
  
  if (existingAuction) {
    console.log('✅ Sample auction already exists')
    return existingAuction
  }
  
  const auctionSettings = {
    lotDuration: 30000,
    softCloseThreshold: 5000,
    softCloseExtension: 10000,
    maxExtensions: 3,
    allowAutoBidding: true
  }
  
  // Get all players for this season
  const players = await prisma.player.findMany({
    where: { seasonId },
    orderBy: { basePrice: 'desc' }
  })
  
  const auction = await prisma.$transaction(async (tx) => {
    // Create auction
    const newAuction = await tx.auction.create({
      data: {
        name: 'IPL 2024 Player Auction',
        seasonId,
        settings: JSON.stringify(auctionSettings)
      }
    })
    
    // Create lots for all players
    const lots = players.map((player, index) => ({
      auctionId: newAuction.id,
      playerId: player.id,
      order: index + 1
    }))
    
    await tx.lot.createMany({
      data: lots
    })
    
    return newAuction
  })
  
  console.log(`✅ Created auction with ${players.length} lots`)
  return auction
}

async function displayBootstrapSummary() {
  console.log('\\n📊 Bootstrap Summary:')
  console.log('=' .repeat(50))
  
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.season.count(),
    prisma.team.count(),
    prisma.player.count(),
    prisma.auction.count(),
    prisma.lot.count()
  ])
  
  console.log(`👥 Users: ${counts[0]}`)
  console.log(`🏏 Seasons: ${counts[1]}`)
  console.log(`👑 Teams: ${counts[2]}`)
  console.log(`🏃 Players: ${counts[3]}`)
  console.log(`🎯 Auctions: ${counts[4]}`)
  console.log(`📦 Lots: ${counts[5]}`)
  
  console.log('\\n🔐 Login Credentials:')
  console.log('Admin: admin@iplauction.com / admin123')
  console.log('Teams: [teamcode]@iplauction.com / team123')
  console.log('Example: mi@iplauction.com / team123')
  
  console.log('\\n🚀 Bootstrap completed successfully!')
  console.log('You can now start the application and begin using the auction system.')
}

async function main() {
  try {
    console.log('🚀 Starting IPL Auction System Bootstrap...')
    console.log('=' .repeat(50))
    
    // Create admin user
    await createAdminUser()
    
    // Create sample season
    const season = await createSampleSeason()
    
    // Create sample teams
    const teams = await createSampleTeams(season.id)
    
    // Create sample players
    await createSamplePlayers(season.id)
    
    // Create team users
    await createSampleTeamUsers(teams)
    
    // Create sample auction
    await createSampleAuction(season.id)
    
    // Display summary
    await displayBootstrapSummary()
    
  } catch (error) {
    console.error('❌ Bootstrap failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run bootstrap if this script is executed directly
if (require.main === module) {
  main()
}

module.exports = {
  createAdminUser,
  createSampleSeason,
  createSampleTeams,
  createSamplePlayers,
  createSampleTeamUsers,
  createSampleAuction
}
