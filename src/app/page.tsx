/**
 * IPL Auction System - Landing Page
 * Modern, responsive landing page with features showcase and role-based onboarding
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRightIcon, PlayIcon, ChartBarIcon, CurrencyDollarIcon, ClockIcon, DevicePhoneMobileIcon, GlobeAltIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      {/* Navigation */}
      <nav className="relative z-10 px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">IPL</span>
            </div>
            <span className="text-white text-xl font-bold">Auction Pro</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-blue-100 hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#demo" className="text-blue-100 hover:text-white transition-colors">
              Demo
            </Link>
            <Link
              href="/auth/signin"
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Sign In
            </Link>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <Link
              href="/auth/signin"
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
              The Future of
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">
                Cricket Auctions
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Run live, real-time cricket player auctions with zero latency. 
              Built for speed, designed for scale, optimized for mobile.
            </p>
            
            {/* Live Demo Banner */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full inline-flex items-center space-x-2 mb-8">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="font-medium">Live Demo Available</span>
              <span className="text-green-100">•</span>
              <span className="text-green-100">₹2.4Cr in active bids</span>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link
                href="/demo"
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center space-x-2"
              >
                <PlayIcon className="w-5 h-5" />
                <span>Start Live Demo</span>
              </Link>
              
              <Link
                href="/auth/register"
                className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:bg-white/20 flex items-center space-x-2"
              >
                <span>Create Account</span>
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </div>
            
            {/* Trust Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-white">50K+</div>
                <div className="text-blue-200">Active Users</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">500+</div>
                <div className="text-blue-200">Auctions Run</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">₹100Cr+</div>
                <div className="text-blue-200">Bids Processed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">99.9%</div>
                <div className="text-blue-200">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Choose Auction Pro?
            </h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Built from the ground up for modern cricket auctions with enterprise-grade features
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Real-time Performance */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
                <ClockIcon className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Real-time Performance</h3>
              <p className="text-blue-100 mb-4">
                Sub-100ms latency ensures every bid is captured instantly. WebSocket-first architecture eliminates delays.
              </p>
              <ul className="space-y-2 text-sm text-blue-200">
                <li className="flex items-center space-x-2">
                  <CheckIcon className="w-4 h-4 text-green-400" />
                  <span>WebSocket-first communication</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckIcon className="w-4 h-4 text-green-400" />
                  <span>Soft-close bid extensions</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckIcon className="w-4 h-4 text-green-400" />
                  <span>Conflict-free bid resolution</span>
                </li>
              </ul>
            </div>
            
            {/* Mobile-First Design */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <DevicePhoneMobileIcon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Mobile-First Design</h3>
              <p className="text-blue-100 mb-4">
                Optimized for touch interfaces with responsive design that works seamlessly across all devices.
              </p>
              <ul className="space-y-2 text-sm text-blue-200">
                <li className="flex items-center space-x-2">
                  <CheckIcon className="w-4 h-4 text-green-400" />
                  <span>Touch-optimized bid controls</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckIcon className="w-4 h-4 text-green-400" />
                  <span>Responsive layouts</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckIcon className="w-4 h-4 text-green-400" />
                  <span>Offline bid queueing</span>
                </li>
              </ul>
            </div>
            
            {/* Advanced Analytics */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <ChartBarIcon className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Advanced Analytics</h3>
              <p className="text-blue-100 mb-4">
                Comprehensive insights into bidding patterns, team strategies, and auction performance.
              </p>
              <ul className="space-y-2 text-sm text-blue-200">
                <li className="flex items-center space-x-2">
                  <CheckIcon className="w-4 h-4 text-green-400" />
                  <span>Real-time dashboards</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckIcon className="w-4 h-4 text-green-400" />
                  <span>Bidding pattern analysis</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckIcon className="w-4 h-4 text-green-400" />
                  <span>Custom report generation</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Auctions?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of cricket organizations already using Auction Pro
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/demo"
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center justify-center space-x-2"
            >
              <PlayIcon className="w-5 h-5" />
              <span>Try Live Demo</span>
            </Link>
            
            <Link
              href="/auth/register"
              className="bg-white text-blue-900 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:bg-blue-50 flex items-center justify-center space-x-2"
            >
              <span>Get Started Free</span>
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          </div>
          
          <p className="text-blue-200 mt-6">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-900/50 backdrop-blur-sm border-t border-white/10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">IPL</span>
                </div>
                <span className="text-white text-xl font-bold">Auction Pro</span>
              </div>
              <p className="text-blue-200 mb-4 max-w-md">
                The most advanced cricket auction platform. Built for speed, designed for scale.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-blue-200">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/demo" className="hover:text-white transition-colors">Demo</Link></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-blue-200">
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-blue-200">
              © 2024 Auction Pro. All rights reserved.
            </p>
            <p className="text-blue-200 mt-4 md:mt-0">
              Built with ❤️ for cricket lovers
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
