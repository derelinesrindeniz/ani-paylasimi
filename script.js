const selectPhotoBtn = document.getElementById("selectPhotoBtn");
const photoInput = document.getElementById("photoInput");
const selectedInfo = document.getElementById("selectedInfo");
const gallery = document.getElementById("gallery");
const galleryStatus = document.getElementById("galleryStatus");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");


const BUCKET_NAME = "dugun";
const MAX_FILES_PER_SELECTION = 10;
const MAX_FILE_SIZE = 6 * 1024 * 1024;

selectPhotoBtn.addEventListener("click", function () {
    photoInput.click();
});

photoInput.addEventListener("change", async function () {
    const files = Array.from(photoInput.files);

    if (files.length === 0) {
        selectedInfo.textContent = "";
        return;
    }

    if (files.length > MAX_FILES_PER_SELECTION) {
        selectedInfo.textContent =
            "❌ Tek seferde en fazla 10 fotoğraf seçebilirsin.";

        photoInput.value = "";
        return;
    }

    const invalidFile = files.find(function (file) {
        return !file.type.startsWith("image/");
    });

    if (invalidFile) {
        selectedInfo.textContent =
            "❌ Yalnızca fotoğraf dosyaları yüklenebilir.";

        photoInput.value = "";
        return;
    }

    const oversizedFile = files.find(function (file) {
        return file.size > MAX_FILE_SIZE;
    });

    if (oversizedFile) {
        selectedInfo.textContent =
            "❌ Her fotoğraf en fazla 6 MB olabilir.";

        photoInput.value = "";
        return;
    }

    selectPhotoBtn.disabled = true;

    let successfulUploads = 0;

    for (let index = 0; index < files.length; index++) {
        const file = files[index];

        selectedInfo.textContent =
            `📤 ${index + 1}/${files.length} fotoğraf yükleniyor...`;

        const extension =
            file.name.split(".").pop()?.toLowerCase() || "jpg";

        const randomPart =
            Math.random().toString(36).slice(2, 10);

        const fileName =
            `${Date.now()}-${randomPart}.${extension}`;

        const { error } = await supabaseClient
            .storage
            .from(BUCKET_NAME)
            .upload(fileName, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            });

        if (error) {
            console.error("Yükleme hatası:", error);

            selectedInfo.textContent =
                `❌ ${index + 1}. fotoğraf yüklenemedi.`;

            selectPhotoBtn.disabled = false;
            return;
        }

        successfulUploads++;
    }

    selectedInfo.textContent =
        `✅ ${successfulUploads} fotoğraf başarıyla yüklendi!`;

    photoInput.value = "";
    selectPhotoBtn.disabled = false;

    await loadGallery();
});

async function loadGallery() {
    gallery.innerHTML = "";
    galleryStatus.textContent = "Fotoğraflar yükleniyor...";

    const { data: files, error } = await supabaseClient
        .storage
        .from(BUCKET_NAME)
        .list("", {
            limit: 1000,
            offset: 0,
            sortBy: {
                column: "created_at",
                order: "desc"
            }
        });

    if (error) {
        console.error("Galeri hatası:", error);

        galleryStatus.textContent =
            "Fotoğraflar şu anda görüntülenemiyor.";

        return;
    }

    const imageFiles = files.filter(function (file) {
        return file.id && file.name;
    });

    if (imageFiles.length === 0) {
        galleryStatus.textContent =
            "Henüz fotoğraf yüklenmedi.";

        return;
    }

    galleryStatus.textContent = "";

    imageFiles.forEach(function (file) {

    const { data } = supabaseClient
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(file.name);

    if (!data.publicUrl) {
        return;
    }

    const image = new Image();

    image.onload = function () {

        const item = document.createElement("button");
        item.className = "gallery-item";
        item.type = "button";

        item.appendChild(image);

        item.addEventListener("click", function () {
            lightboxImage.src = data.publicUrl;
            lightbox.classList.add("active");
        });

        gallery.appendChild(item);

    };

    image.onerror = function () {
        console.log("Bozuk dosya atlandı:", file.name);
    };

    image.src = data.publicUrl;
    image.alt = "Berfin ve Emre düğün hatırası";
    image.loading = "lazy";

});
}
lightboxClose.addEventListener("click", function () {
    lightbox.classList.remove("active");
    lightboxImage.src = "";
});

lightbox.addEventListener("click", function (event) {
    if (event.target === lightbox) {
        lightbox.classList.remove("active");
        lightboxImage.src = "";
    }
});
loadGallery();