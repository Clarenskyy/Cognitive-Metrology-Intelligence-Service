import { InstrumentProfile } from "./types";

export const PRESET_MANUALS: Record<string, string> = {
  "Fluke 8846A": `FLUKE 8846A REFERENCE DIGITAL MULTIMETER MANUAL
Section 4: Technical Specifications & Automated Calibration
Accuracy specifications are 1-year bounds, operates at 18-28C, Relative Humidity range 10-70%.
Tolerance rules:
100 mV Range: Nominal DC test points should remain within 35 PPM of nominal value.
SCPI verify: CONF:VOLT:DC 0.1; READ?
1 V Range: Nominal test points within 24 PPM.
SCPI verify: CONF:VOLT:DC 1; READ?
10 V Range: Nominal test points within 24 PPM. Standard precision metrology loop calibration.
SCPI verify: CONF:VOLT:DC 10; READ?
Resistance 2-wire Range (10 kOhm Range): Accuracy within 50 PPM under standard shield test protocols.
SCPI verify: CONF:RES 10000; READ?
AC Voltage (1 kHz): nominal 1V accuracy is within 600 PPM of source target.
SCPI verify: CONF:VOLT:AC 1; READ?`,

  "Keysight 3458A": `KEYSIGHT TECHNOLOGIES 3458A 8.5-DIGIT MULTIMETER MANUAL
Section 1-3: Metrology Reference Calibration Specifications.
The ultra-precision 3458A supports premium transfer standards. 1-year accuracy requirements:
DCV 10V Range: Nominal is 10.0V. Accuracy upper/lower limit is defined by a strict 8 PPM threshold.
SCPI execution: PRESET; NPLC 100; RANGE 10; TARM HOLD; TRIG SGL; READ?
DCV 100V Range: 1-year tolerance boundary is exactly 14 PPM of target value.
SCPI execution: PRESET; NPLC 100; RANGE 100; TARM HOLD; TRIG SGL; READ?
4-Wire Ohm Resistance (10 kOhm Range): Nominal 10 kOhm. Specified tolerance is 10 PPM.
SCPI execution: PRESET; OHMF; RANGE 10000; TARM HOLD; TRIG SGL; READ?
DC Current (10 mA Range): Meter 1-year limit is within 55 PPM of actual.
SCPI execution: PRESET; RANGE 0.01; TARM HOLD; TRIG SGL; READ?`,

  "Keithley 2450": `KEITHLEY Instruments 2450 SYSTEM SOURCEMETER MANUAL
Technical specification extraction and SCPI driver definitions.
Voltage Sourcing & Measure parameters (Source-Measure Unit):
Voltage Source Compliance (20 V Range): Set target at 15.0V. Output tolerance remains within 200 PPM.
SCPI verification command: SOUR:FUNC VOLT; SOUR:VOLT 15.0; OUTP ON
Voltage Measurement (200 V Range): Input at 100.0V. Passive accuracy is within 150 PPM.
SCPI verification command: SENS:FUNC 'VOLT'; SENS:VOLT:RANG 200; READ?
DC Current Measurement (1 mA Range): Input at 1.0 mA. Calibration tolerance is set to a standard 300 PPM of nominal scale.
SCPI verification command: SENS:FUNC 'CURR'; SENS:CURR:RANG 0.001; READ?`
};

export const INITIAL_PROFILES: InstrumentProfile[] = [
  {
    id: "prof-fluke-8846a",
    name: "Standard Multimeter Lab Standard",
    model: "Fluke 8846A",
    serial_number: "FLK-8846-953321",
    calibration_cycle_months: 12,
    last_calibrated: "2025-06-15",
    spec: {
      instrument_model: "Fluke 8846A",
      extracted_at: "2026-06-15T12:00:00Z",
      embedding_model_selected: "SciBERT (Domain-Specific Embeddings)",
      tolerance_array: [
        {
          id: "f8846a-dcv-100mv",
          parameter: "DC Voltage",
          range: "100 mV",
          test_point: "100.0000 mV",
          nominal_value: 0.1,
          unit: "V",
          tolerance_ppm: 35,
          tolerance_absolute: 0.0000035,
          lower_limit: 0.0999965,
          upper_limit: 0.1000035,
          scpi_command: "CONF:VOLT:DC 0.1; READ?"
        },
        {
          id: "f8846a-dcv-1v",
          parameter: "DC Voltage",
          range: "1 V",
          test_point: "1.000000 V",
          nominal_value: 1.0,
          unit: "V",
          tolerance_ppm: 24,
          tolerance_absolute: 0.000024,
          lower_limit: 0.999976,
          upper_limit: 1.000024,
          scpi_command: "CONF:VOLT:DC 1; READ?"
        },
        {
          id: "f8846a-dcv-10v",
          parameter: "DC Voltage",
          range: "10 V",
          test_point: "10.00000 V",
          nominal_value: 10.0,
          unit: "V",
          tolerance_ppm: 24,
          tolerance_absolute: 0.00024,
          lower_limit: 9.99976,
          upper_limit: 10.00024,
          scpi_command: "CONF:VOLT:DC 10; READ?"
        },
        {
          id: "f8846a-r-10k",
          parameter: "Resistance (2-Wire)",
          range: "10 kOhm",
          test_point: "10.00000 kOhm",
          nominal_value: 10000.0,
          unit: "Ohm",
          tolerance_ppm: 50,
          tolerance_absolute: 0.5,
          lower_limit: 9999.5,
          upper_limit: 10000.5,
          scpi_command: "CONF:RES 10000; READ?"
        },
        {
          id: "f8846a-acv-1v",
          parameter: "AC Voltage (1 kHz)",
          range: "1 V",
          test_point: "1.000000 V",
          nominal_value: 1.0,
          unit: "V",
          tolerance_ppm: 600,
          tolerance_absolute: 0.0006,
          lower_limit: 0.9994,
          upper_limit: 1.0006,
          scpi_command: "CONF:VOLT:AC 1; READ?"
        }
      ]
    },
    runs: [
      {
        run_id: "run-001",
        timestamp: "2025-06-15T09:00:00Z",
        as_found: 10.00001,
        as_left: 10.00001,
        nominal_value: 10.0,
        temperature_c: 22.8,
        humidity_rh: 38.5,
        operating_cycles: 200
      },
      {
        run_id: "run-002",
        timestamp: "2025-08-15T11:30:00Z",
        as_found: 10.00005,
        as_left: 10.00002,
        nominal_value: 10.0,
        temperature_c: 23.4,
        humidity_rh: 42.1,
        operating_cycles: 1900
      },
      {
        run_id: "run-003",
        timestamp: "2025-11-15T10:15:00Z",
        as_found: 10.00011,
        as_left: 10.00003,
        nominal_value: 10.0,
        temperature_c: 24.2,
        humidity_rh: 45.9,
        operating_cycles: 3800
      },
      {
        run_id: "run-004",
        timestamp: "2026-02-15T14:00:00Z",
        as_found: 10.00016,
        as_left: 10.00001,
        nominal_value: 10.0,
        temperature_c: 23.1,
        humidity_rh: 40.2,
        operating_cycles: 5700
      },
      {
        run_id: "run-005",
        timestamp: "2026-05-15T09:45:00Z",
        as_found: 10.00022,
        as_left: 10.00002,
        nominal_value: 10.0,
        temperature_c: 25.6,
        humidity_rh: 52.3,
        operating_cycles: 8500
      }
    ],
    forecast: {
      profile_id: "prof-fluke-8846a",
      current_drift_rate_ppm_month: 2.15,
      projected_oot_date: "2026-11-20",
      days_until_oot: 158,
      confidence_interval: {
        lower_days: 130,
        upper_days: 190
      },
      shap_values: [
        { factor: "Calibration Ingestion History (Age)", shap_value: 1.45, percentage: 42, direction: "accel" },
        { factor: "Mechanical & Electrical Cycle Cycles", shap_value: 0.98, percentage: 28, direction: "accel" },
        { factor: "Sensor Temperature Variability (BME280)", shap_value: 0.54, percentage: 16, direction: "accel" },
        { factor: "Relative Humidity Ambient Shift", shap_value: 0.32, percentage: 11, direction: "accel" },
        { factor: "Device Material Bias Noise", shap_value: 0.12, percentage: 3, direction: "stable" }
      ],
      model_type_used: "Tree-Based Random Forest & XGBoost Ensemble"
    }
  },
  {
    id: "prof-keysight-3458a",
    name: "Ultra-Precision Primary Standard",
    model: "Keysight 3458A",
    serial_number: "KST-3458-4429A2",
    calibration_cycle_months: 6,
    last_calibrated: "2026-01-10",
    spec: null,
    runs: [
      {
        run_id: "run-k01",
        timestamp: "2026-01-10T08:30:00Z",
        as_found: 10.000005,
        as_left: 10.000001,
        nominal_value: 10.0,
        temperature_c: 22.9,
        humidity_rh: 34.2,
        operating_cycles: 1100
      },
      {
        run_id: "run-k02",
        timestamp: "2026-03-10T10:00:00Z",
        as_found: 10.000018,
        as_left: 10.000003,
        nominal_value: 10.0,
        temperature_c: 23.1,
        humidity_rh: 36.5,
        operating_cycles: 2400
      },
      {
        run_id: "run-k03",
        timestamp: "2026-05-10T09:12:00Z",
        as_found: 10.000042,
        as_left: 10.000002,
        nominal_value: 10.0,
        temperature_c: 23.5,
        humidity_rh: 38.0,
        operating_cycles: 4200
      }
    ],
    forecast: null
  },
  {
    id: "prof-keithley-2450",
    name: "SMU Automated Semiconductor Test Rack",
    model: "Keithley 2450",
    serial_number: "KTH-2450-844002",
    calibration_cycle_months: 12,
    last_calibrated: "2025-10-12",
    spec: null,
    runs: [
      {
        run_id: "run-m01",
        timestamp: "2025-10-12T09:00:00Z",
        as_found: 15.0008,
        as_left: 15.0001,
        nominal_value: 15.0,
        temperature_c: 23.8,
        humidity_rh: 45.1,
        operating_cycles: 500
      },
      {
        run_id: "run-m02",
        timestamp: "2026-01-12T13:00:00Z",
        as_found: 15.0022,
        as_left: 15.0002,
        nominal_value: 15.0,
        temperature_c: 24.5,
        humidity_rh: 48.2,
        operating_cycles: 10500
      }
    ],
    forecast: null
  }
];
