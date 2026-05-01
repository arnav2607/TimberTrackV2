#!/usr/bin/env python3
"""
TimberTrack Backend API Test Suite
Tests all extended features including authentication, suppliers, countries, 
purchases with extended container fields, measurements, and dashboard KPIs.
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os

# Get backend URL from frontend .env
BACKEND_URL = "https://05c1b9f8-a323-4566-8326-e35855141ff8.preview.emergentagent.com/api"

class TimberTrackTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.user_data = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        if headers is None:
            headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        headers["Content-Type"] = "application/json"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers)
            elif method == "PATCH":
                response = requests.patch(url, json=data, headers=headers)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None
    
    def test_authentication(self):
        """Test 1: Authentication flow"""
        print("\n=== Testing Authentication ===")
        
        # Generate unique test user
        test_id = str(uuid.uuid4())[:8]
        username = f"testuser_{test_id}"
        
        # Test signup
        signup_data = {
            "full_name": "Test User",
            "username": username,
            "password": "testpass123",
            "company_name": "Test Timber Co"
        }
        
        response = self.make_request("POST", "/auth/signup", signup_data)
        if response and response.status_code == 200:
            data = response.json()
            self.token = data["token"]
            self.user_data = data["user"]
            self.log_test("Signup", True, f"User created: {username}")
        else:
            self.log_test("Signup", False, f"Status: {response.status_code if response else 'No response'}")
            return False
            
        # Test login
        login_data = {
            "username": username,
            "password": "testpass123"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            data = response.json()
            self.token = data["token"]  # Update token
            self.log_test("Login", True, f"Token received")
        else:
            self.log_test("Login", False, f"Status: {response.status_code if response else 'No response'}")
            return False
            
        # Test /auth/me
        response = self.make_request("GET", "/auth/me")
        if response and response.status_code == 200:
            data = response.json()
            if data["company_name"] == "Test Timber Co":
                self.log_test("Auth/Me", True, f"Company: {data['company_name']}")
            else:
                self.log_test("Auth/Me", False, f"Wrong company: {data.get('company_name')}")
        else:
            self.log_test("Auth/Me", False, f"Status: {response.status_code if response else 'No response'}")
            
        return True
    
    def test_suppliers_management(self):
        """Test 2: Suppliers Management"""
        print("\n=== Testing Suppliers Management ===")
        
        # GET /api/suppliers (should be empty initially)
        response = self.make_request("GET", "/suppliers")
        if response and response.status_code == 200:
            suppliers = response.json()
            if len(suppliers) == 0:
                self.log_test("Get Suppliers (Empty)", True, "No suppliers initially")
            else:
                self.log_test("Get Suppliers (Empty)", False, f"Found {len(suppliers)} suppliers")
        else:
            self.log_test("Get Suppliers (Empty)", False, f"Status: {response.status_code if response else 'No response'}")
            
        # POST /api/suppliers - African Forestry Co
        supplier1_data = {"name": "African Forestry Co"}
        response = self.make_request("POST", "/suppliers", supplier1_data)
        if response and response.status_code == 200:
            self.log_test("Create Supplier 1", True, "African Forestry Co created")
        else:
            self.log_test("Create Supplier 1", False, f"Status: {response.status_code if response else 'No response'}")
            
        # POST /api/suppliers - Brazil Timber Ltd
        supplier2_data = {"name": "Brazil Timber Ltd"}
        response = self.make_request("POST", "/suppliers", supplier2_data)
        if response and response.status_code == 200:
            self.log_test("Create Supplier 2", True, "Brazil Timber Ltd created")
        else:
            self.log_test("Create Supplier 2", False, f"Status: {response.status_code if response else 'No response'}")
            
        # GET /api/suppliers (should return 2 suppliers)
        response = self.make_request("GET", "/suppliers")
        if response and response.status_code == 200:
            suppliers = response.json()
            if len(suppliers) == 2:
                names = [s["name"] for s in suppliers]
                if "African Forestry Co" in names and "Brazil Timber Ltd" in names:
                    self.log_test("Get Suppliers (2)", True, f"Found 2 suppliers: {names}")
                else:
                    self.log_test("Get Suppliers (2)", False, f"Wrong suppliers: {names}")
            else:
                self.log_test("Get Suppliers (2)", False, f"Found {len(suppliers)} suppliers")
        else:
            self.log_test("Get Suppliers (2)", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_countries_management(self):
        """Test 3: Countries Management"""
        print("\n=== Testing Countries Management ===")
        
        # POST /api/countries/seed
        response = self.make_request("POST", "/countries/seed")
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Seed Countries", True, f"Added {len(data['added'])} countries")
        else:
            self.log_test("Seed Countries", False, f"Status: {response.status_code if response else 'No response'}")
            
        # GET /api/countries (should return 14+ countries)
        response = self.make_request("GET", "/countries")
        if response and response.status_code == 200:
            countries = response.json()
            if len(countries) >= 14:
                self.log_test("Get Countries (14+)", True, f"Found {len(countries)} countries")
            else:
                self.log_test("Get Countries (14+)", False, f"Found only {len(countries)} countries")
        else:
            self.log_test("Get Countries (14+)", False, f"Status: {response.status_code if response else 'No response'}")
            
        # POST /api/countries - Custom Country
        custom_country_data = {"name": "Custom Country"}
        response = self.make_request("POST", "/countries", custom_country_data)
        if response and response.status_code == 200:
            self.log_test("Create Custom Country", True, "Custom Country created")
        else:
            self.log_test("Create Custom Country", False, f"Status: {response.status_code if response else 'No response'}")
            
        # GET /api/countries (should include Custom Country)
        response = self.make_request("GET", "/countries")
        if response and response.status_code == 200:
            countries = response.json()
            names = [c["name"] for c in countries]
            if "Custom Country" in names:
                self.log_test("Get Countries (with Custom)", True, f"Custom Country found in {len(countries)} countries")
            else:
                self.log_test("Get Countries (with Custom)", False, "Custom Country not found")
        else:
            self.log_test("Get Countries (with Custom)", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_extended_purchase_creation(self):
        """Test 4: Extended Purchase Creation"""
        print("\n=== Testing Extended Purchase Creation ===")
        
        purchase_data = {
            "bl_number": "BL-TEST-001",
            "bl_date": "2025-01-15",
            "supplier_name": "African Forestry Co",
            "country": "Cameroon",
            "containers": [
                {
                    "container_number": "MSCU1234567",
                    "cbm_gross": 45.5,
                    "cbm_net": 44.2,
                    "pcs_supplier": 120,
                    "l_avg": 5.8,
                    "quality_supplier": "Grade A"
                },
                {
                    "container_number": "MSCU7654321",
                    "cbm_gross": 50.0,
                    "cbm_net": 48.5,
                    "pcs_supplier": 150,
                    "l_avg": 6.2,
                    "quality_supplier": "N5V"
                }
            ]
        }
        
        response = self.make_request("POST", "/purchases", purchase_data)
        if response and response.status_code == 200:
            data = response.json()
            self.purchase_id = data["id"]
            self.log_test("Create Extended Purchase", True, f"Purchase ID: {self.purchase_id}")
            
            # Verify auto-calculated avg_girth values
            response = self.make_request("GET", f"/purchases/{self.purchase_id}")
            if response and response.status_code == 200:
                purchase = response.json()
                containers = purchase["containers"]
                
                # Check first container calculations
                container1 = containers[0]
                expected_gross_girth = round((45.5 * 35.315) / 120, 4)
                expected_net_girth = round((44.2 * 35.315) / 120, 4)
                
                if (container1.get("avg_girth_gross") == expected_gross_girth and 
                    container1.get("avg_girth_net") == expected_net_girth):
                    self.log_test("Auto-calculated Girth", True, 
                                f"Gross: {container1['avg_girth_gross']}, Net: {container1['avg_girth_net']}")
                else:
                    self.log_test("Auto-calculated Girth", False, 
                                f"Expected Gross: {expected_gross_girth}, Got: {container1.get('avg_girth_gross')}")
                    
                # Store first container ID for measurements test
                self.container_id = containers[0]["id"]
                
            else:
                self.log_test("Verify Purchase Details", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("Create Extended Purchase", False, f"Status: {response.status_code if response else 'No response'}")
            return False
            
        return True
    
    def test_measurements(self):
        """Test 5: Measurements"""
        print("\n=== Testing Measurements ===")
        
        if not hasattr(self, 'container_id'):
            self.log_test("Measurements", False, "No container ID available")
            return False
            
        measurements_data = {
            "measurements": [
                {"le1": 580, "l": 570, "g1": 45, "g2": 44},
                {"le1": 620, "l": 610, "g1": 48, "g2": 47}
            ],
            "mark_complete": False
        }
        
        response = self.make_request("POST", f"/containers/{self.container_id}/measurements", measurements_data)
        if response and response.status_code == 200:
            data = response.json()
            if data.get("saved") == 2:
                self.log_test("Add Measurements", True, f"Saved {data['saved']} measurements")
            else:
                self.log_test("Add Measurements", False, f"Expected 2, saved {data.get('saved')}")
        else:
            self.log_test("Add Measurements", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_completion_form(self):
        """Test 6: Completion Form"""
        print("\n=== Testing Completion Form ===")
        
        if not hasattr(self, 'container_id'):
            self.log_test("Completion Form", False, "No container ID available")
            return False
            
        completion_data = {
            "bend_percent": 5.5,
            "quality_by_us": "Good Quality",
            "measurement_date": "2025-01-16"
        }
        
        response = self.make_request("PATCH", f"/containers/{self.container_id}/completion-form", completion_data)
        if response and response.status_code == 200:
            self.log_test("Update Completion Form", True, "Completion form updated")
            
            # Verify container is marked complete
            response = self.make_request("GET", f"/containers/{self.container_id}")
            if response and response.status_code == 200:
                container = response.json()
                if (container.get("is_loading_complete") and 
                    container.get("completed_at") and
                    container.get("bend_percent") == 5.5 and
                    container.get("quality_by_us") == "Good Quality"):
                    self.log_test("Verify Container Completion", True, "Container marked complete with timestamp")
                else:
                    self.log_test("Verify Container Completion", False, 
                                f"Complete: {container.get('is_loading_complete')}, "
                                f"Timestamp: {container.get('completed_at')}")
            else:
                self.log_test("Verify Container Completion", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("Update Completion Form", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_enhanced_dashboard_kpis(self):
        """Test 7: Enhanced Dashboard KPIs"""
        print("\n=== Testing Enhanced Dashboard KPIs ===")
        
        response = self.make_request("GET", "/dashboard/kpis")
        if response and response.status_code == 200:
            data = response.json()
            
            # Check required sections
            required_sections = ["overview", "volume", "alerts", "pending_containers", "pending_bls", "recent_activity"]
            missing_sections = [section for section in required_sections if section not in data]
            
            if not missing_sections:
                self.log_test("Dashboard KPIs Structure", True, "All required sections present")
                
                # Check overview section
                overview = data["overview"]
                required_overview = ["total_bls", "active_bls", "completed_bls", "total_containers"]
                if all(key in overview for key in required_overview):
                    self.log_test("Dashboard Overview", True, 
                                f"BLs: {overview['total_bls']}, Containers: {overview['total_containers']}")
                else:
                    self.log_test("Dashboard Overview", False, "Missing overview fields")
                
                # Check volume section
                volume = data["volume"]
                required_volume = ["total_pieces", "total_cbm1", "total_cft1", "total_cbm2", "total_cft2"]
                if all(key in volume for key in required_volume):
                    self.log_test("Dashboard Volume", True, 
                                f"Pieces: {volume['total_pieces']}, CBM2: {volume['total_cbm2']}")
                else:
                    self.log_test("Dashboard Volume", False, "Missing volume fields")
                
                # Check alerts section
                alerts = data["alerts"]
                required_alerts = ["bls_not_started", "bls_in_progress", "containers_pending", "containers_completed"]
                if all(key in alerts for key in required_alerts):
                    self.log_test("Dashboard Alerts", True, 
                                f"Pending containers: {alerts['containers_pending']}, "
                                f"Completed: {alerts['containers_completed']}")
                else:
                    self.log_test("Dashboard Alerts", False, "Missing alert fields")
                    
            else:
                self.log_test("Dashboard KPIs Structure", False, f"Missing sections: {missing_sections}")
        else:
            self.log_test("Dashboard KPIs", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_get_purchase_extended_fields(self):
        """Test 8: GET Purchase with Extended Fields"""
        print("\n=== Testing GET Purchase with Extended Fields ===")
        
        if not hasattr(self, 'purchase_id'):
            self.log_test("Get Purchase Extended", False, "No purchase ID available")
            return False
            
        response = self.make_request("GET", f"/purchases/{self.purchase_id}")
        if response and response.status_code == 200:
            purchase = response.json()
            containers = purchase.get("containers", [])
            
            if containers:
                container = containers[0]
                
                # Check extended fields
                extended_fields = [
                    "cbm_gross", "cbm_net", "pcs_supplier", "avg_girth_gross", "avg_girth_net",
                    "l_avg", "quality_supplier", "bend_percent", "quality_by_us", 
                    "measurement_date", "completed_at"
                ]
                
                present_fields = [field for field in extended_fields if field in container]
                
                if len(present_fields) == len(extended_fields):
                    self.log_test("Purchase Extended Fields", True, 
                                f"All {len(extended_fields)} extended fields present")
                else:
                    missing = [field for field in extended_fields if field not in container]
                    self.log_test("Purchase Extended Fields", False, f"Missing fields: {missing}")
            else:
                self.log_test("Purchase Extended Fields", False, "No containers found")
        else:
            self.log_test("Get Purchase Extended", False, f"Status: {response.status_code if response else 'No response'}")
    
    def run_all_tests(self):
        """Run all test scenarios"""
        print("🚀 Starting TimberTrack Backend API Tests")
        print(f"Backend URL: {self.base_url}")
        
        # Run tests in sequence
        if not self.test_authentication():
            print("❌ Authentication failed - stopping tests")
            return
            
        self.test_suppliers_management()
        self.test_countries_management()
        
        if self.test_extended_purchase_creation():
            self.test_measurements()
            self.test_completion_form()
            
        self.test_enhanced_dashboard_kpis()
        self.test_get_purchase_extended_fields()
        
        # Summary
        print("\n" + "="*50)
        print("📊 TEST SUMMARY")
        print("="*50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = TimberTrackTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)