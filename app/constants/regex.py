import re

# Regex String Patterns & Compiled Objects
PAN_REGEX_PATTERN = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
GSTIN_REGEX_PATTERN = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
PINCODE_REGEX_PATTERN = r"^[1-9][0-9]{5}$"
PHONE_REGEX_PATTERN = r"^[6-9]\d{9}$"
DOB_REGEX_PATTERN = r"^\d{4}-\d{2}-\d{2}$"

PAN_REGEX = re.compile(PAN_REGEX_PATTERN)
GSTIN_REGEX = re.compile(GSTIN_REGEX_PATTERN)
PINCODE_REGEX = re.compile(PINCODE_REGEX_PATTERN)
PHONE_REGEX = re.compile(PHONE_REGEX_PATTERN)
DOB_REGEX = re.compile(DOB_REGEX_PATTERN)
