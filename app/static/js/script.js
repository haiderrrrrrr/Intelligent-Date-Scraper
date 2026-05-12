document.getElementById("scrapeButton").addEventListener("click", scrapeData);
document
  .getElementById("downloadPdfButton")
  .addEventListener("click", downloadPDF);
document
  .getElementById("downloadCsvButton")
  .addEventListener("click", downloadCSV);

async function scrapeData() {
  const url = document.getElementById("urlInput").value.trim();
  const scrapedDataDiv = document.getElementById("scrapedData");
  const dateListElement = document.getElementById("dateList");
  const datesListSection = document.getElementById("datesList");
  const downloadButtons = document.getElementById("downloadButtons");
  const loader = document.getElementById("loader");

  if (!url) {
    displayMessage("Error: Please enter a valid URL!", "error");
    return;
  }

  loader.style.display = "block";
  displayMessage("Scraping.................... Please wait!", "loading");
  dateListElement.innerHTML = "";
  removePreviousHighlights();

  try {
    const response = await fetch(`/scrape?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    loader.style.display = "none";

    if (data.dates && data.dates.length > 0) {
      displayMessage(`Found ${data.dates.length} date(s)!`, "success");
      displayDatesList(data.dates);
      highlightDates(data.dates);
      datesListSection.style.display = "block";
      downloadButtons.style.display = "block";
    } else {
      displayMessage("No dates found on the page.", "error");
      downloadButtons.style.display = "none";
    }
  } catch (error) {
    loader.style.display = "none";
    displayMessage("Error occurred while scraping!", "error");
  }
}

function displayMessage(message, type) {
  const scrapedDataDiv = document.getElementById("scrapedData");
  scrapedDataDiv.style.display = "block";

  if (type === "success") {
    scrapedDataDiv.className = "success";
  } else if (type === "error") {
    scrapedDataDiv.className = "error";
  } else {
    scrapedDataDiv.className = "";
  }

  scrapedDataDiv.innerHTML = message;
}

function highlightDates(dates) {
  const elements = document.querySelectorAll(
    "p, span, div, h1, h2, h3, h4, h5, h6"
  );

  dates.forEach((date) => {
    const regex = new RegExp(`(${date.date})`, "gi");
    elements.forEach((element) => {
      if (element.innerHTML.includes(date.date)) {
        element.innerHTML = element.innerHTML.replace(
          regex,
          `<span class="highlight">$1</span>`
        );
      }
    });
  });
}

function removePreviousHighlights() {
  document.querySelectorAll(".highlight").forEach((el) => {
    el.outerHTML = el.innerText;
  });
}

function displayDatesList(dates) {
  const dateListElement = document.getElementById("dateList");
  dateListElement.innerHTML = "";

  dates.forEach((date) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong style="color: #ffcc00;">${date.date}</strong>: <span>${date.context}</span>`;
    dateListElement.appendChild(li);
  });
}

function downloadCSV() {
  const dates = Array.from(document.querySelectorAll("#dateList li")).map(
    (li) => li.innerText
  );

  if (dates.length === 0) {
    alert("No data to download.");
    return;
  }

  let csvContent =
    "Date,Context\n" +
    dates.map((line) => `"${line.replace(/:/, '","')}"`).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "extracted_dates.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadPDF() {
  const dates = Array.from(document.querySelectorAll("#dateList li")).map(
    (li) => li.innerText
  );

  if (dates.length === 0) {
    alert("No data to download.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(11);
  doc.text("Extracted Dates", 20, 20);

  let y = 40;
  dates.forEach((date, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${index + 1}. ${date}`, 20, y);
    y += 10;
  });

  doc.save("extracted_dates.pdf");
}
