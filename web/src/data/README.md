# Data Utilities

Utilities for loading, parsing, and transforming data from APIs.

## 📄 Files

### `tsv.js`
**TSV (Tab-Separated Values) Parser**

Functions:
- `parseTSV(tsvText)` - Parse TSV text into array of objects

Features:
- Reads header row for column names
- Converts each data row into key-value object
- Handles empty values and whitespace
- Splits on tab characters (`\t`)

Example Usage:
```javascript
import { parseTSV } from './data/tsv.js';

const response = await fetch('/api/data/threat-actors.tsv');
const tsvText = await response.text();
const rows = parseTSV(tsvText);

// Result:
// [
//   { Country: "US", ThreatScore: "85", ActorCount: "12" },
//   { Country: "RU", ThreatScore: "92", ActorCount: "18" },
//   ...
// ]
```

Input Format:
```
Country\tThreatScore\tActorCount
US\t85\t12
RU\t92\t18
CN\t78\t9
```

Output Format:
```javascript
[
  { Country: "US", ThreatScore: "85", ActorCount: "12" },
  { Country: "RU", ThreatScore: "92", ActorCount: "18" },
  { Country: "CN", ThreatScore: "78", ActorCount: "9" }
]
```

## 🎯 Use Cases

### Threat Actors Heatmap
Load and parse threat actor country data:
```javascript
const resp = await fetch('/api/data/threat-actors.tsv');
const tsv = await resp.text();
const threatData = parseTSV(tsv);

// Map to country scores
const countryScores = {};
threatData.forEach(row => {
  countryScores[row.Country] = parseFloat(row.ThreatScore);
});
```

### Custom TSV Data Sources
Any TSV file can be loaded and parsed:
```javascript
// Load custom TSV from API
const response = await fetch('/api/data/custom-source.tsv');
const text = await response.text();
const data = parseTSV(text);

// Process rows
data.forEach(row => {
  console.log(row.ColumnName, row.ColumnValue);
});
```

## 📝 Notes

- **Tab-delimited only**: Uses `\t` as delimiter (not commas)
- **String values**: All values returned as strings (convert numbers as needed)
- **No escaping**: Does not handle escaped tabs or newlines within values
- **Empty values**: Empty cells become empty strings `""`
- **Trims whitespace**: Automatically trims leading/trailing spaces

## 🔧 Error Handling

The parser is simple and doesn't throw errors, but may produce unexpected results if:
- File has no header row
- Rows have different column counts
- File has mixed delimiters (tabs and commas)

Always validate data after parsing:
```javascript
const data = parseTSV(tsvText);
if (!data || data.length === 0) {
  console.error('No data parsed from TSV');
  return;
}
```
