/**
 * Types for the Cognitive Metrology Intelligence Service (CMIS)
 */

export interface ToleranceItem {
  id: string;
  parameter: string; // e.g. "DC Voltage", "AC Current", "Resistance"
  range: string; // e.g. "100 mV", "1 V", "10 kOhm"
  test_point: string; // e.g. "100.000 mV"
  nominal_value: number; // Numeric value in primary unit
  unit: string; // e.g. "V", "A", "Ohm"
  tolerance_ppm: number; // Tolerance in Parts Per Million (PPM)
  tolerance_absolute: number; // Calculated absolute tolerance
  lower_limit: number; // lower pass boundary
  upper_limit: number; // upper pass boundary
  scpi_command: string; // SCPI calibration command for automated verification
}

export interface CalibrationSpec {
  instrument_model: string;
  extracted_at: string;
  embedding_model_selected: string;
  tolerance_array: ToleranceItem[];
}

export interface CalibrationRun {
  run_id: string;
  timestamp: string;
  as_found: number;
  as_left: number;
  nominal_value: number;
  temperature_c: number;
  humidity_rh: number;
  operating_cycles: number;
}

export interface ShapValue {
  factor: string;
  shap_value: number;
  percentage: number;
  direction: 'accel' | 'decel' | 'stable'; // Impact on degradation
}

export interface DriftForecast {
  profile_id: string;
  current_drift_rate_ppm_month: number;
  projected_oot_date: string;
  days_until_oot: number;
  confidence_interval: {
    lower_days: number;
    upper_days: number;
  };
  shap_values: ShapValue[];
  model_type_used: string;
}

export interface InstrumentProfile {
  id: string;
  name: string;
  model: string;
  serial_number: string;
  calibration_cycle_months: number;
  last_calibrated: string;
  spec: CalibrationSpec | null;
  runs: CalibrationRun[];
  forecast: DriftForecast | null;
}
