const selectPhotoBtn = document.getElementById("selectPhotoBtn");
const photoInput = document.getElementById("photoInput");
const selectedInfo = document.getElementById("selectedInfo");

selectPhotoBtn.addEventListener("click", function () {
    photoInput.click();
});

photoInput.addEventListener("change", function () {
    const photoCount = photoInput.files.length;

    if (photoCount === 0) {
        selectedInfo.textContent = "";
        return;
    }

    selectedInfo.textContent = photoCount + " fotoğraf seçildi.";
});