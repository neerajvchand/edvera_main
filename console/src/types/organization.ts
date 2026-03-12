/* ------------------------------------------------------------------ */
/* Shared organization types — schools, districts, county offices      */
/* ------------------------------------------------------------------ */

export interface SchoolRecord {
  id: string;
  name: string;
  address: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
  principal_name: string | null;
  district_id: string | null;
}

export interface DistrictRecord {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  superintendent_name: string | null;
  county_office_id: string | null;
}

export interface CountyOfficeRecord {
  id: string;
  name: string;
  short_name: string | null;
  sarb_coordinator_name: string | null;
  sarb_coordinator_email: string | null;
  sarb_coordinator_phone: string | null;
  sarb_meeting_location: string | null;
  sarb_meeting_schedule: string | null;
  sarb_referral_instructions: string | null;
}
