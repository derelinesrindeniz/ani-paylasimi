const selectPhotoBtn = document.getElementById("selectPhotoBtn");
const photoInput = document.getElementById("photoInput");
const selectedInfo = document.getElementById("selectedInfo");
const gallery = document.getElementById("gallery");
const galleryStatus = document.getElementById("galleryStatus");

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxPrev = document.getElementById("lightboxPrev");
const lightboxNext = document.getElementById("lightboxNext");
const downloadPhotoBtn =
    document.getElementById("downloadPhotoBtn");

const memoryForm = document.getElementById("memoryForm");
const memoryName = document.getElementById("memoryName");
const memoryText = document.getElementById("memoryText");
const memoryWordCount =
    document.getElementById("memoryWordCount");
const memorySubmitBtn =
    document.getElementById("memorySubmitBtn");
const memoryFormStatus =
    document.getElementById("memoryFormStatus");
const memoryBoard =
    document.getElementById("memoryBoard");
const memoryBoardStatus =
    document.getElementById("memoryBoardStatus");
const memoryCount =
    document.getElementById("memoryCount");

const BUCKET_NAME = "dugun";
const MAX_FILES_PER_SELECTION = 10;
const MAX_FILE_SIZE = 6 * 1024 * 1024;
const MAX_MEMORY_WORDS = 200;
async function ensureAnonymousUser() {
    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (session) {
        return session.user;
    }

    const { data, error } =
        await supabaseClient.auth.signInAnonymously();

    if (error) {
        console.error(error);
        alert("Anonim giriş yapılamadı.");
        return null;
    }

    return data.user;
}

let galleryPhotos = [];
let currentPhotoIndex = 0;
let touchStartX = 0;
let currentUser = null;


/*
=================================
FOTOĞRAF SEÇME VE YÜKLEME
=================================
*/

selectPhotoBtn.addEventListener("click", function () {
    photoInput.click();
});

photoInput.addEventListener("change", async function () {
    if (!currentUser) {
        currentUser = await ensureAnonymousUser();
    }

    if (!currentUser) {
        selectedInfo.textContent =
            "❌ Kullanıcı bağlantısı kurulamadı.";

        photoInput.value = "";
        return;
    }
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
            `${currentUser.id}--${Date.now()}-${randomPart}.${extension}`;

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
            photoInput.value = "";
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


/*
=================================
GALERİYİ YÜKLEME
=================================
*/

async function loadGallery() {
    gallery.innerHTML = "";
    galleryStatus.textContent =
        "Fotoğraflar yükleniyor...";

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

        galleryPhotos = [];
        return;
    }

    const checkedPhotos = await Promise.all(
        imageFiles.map(async function (file) {
            const { data } = supabaseClient
                .storage
                .from(BUCKET_NAME)
                .getPublicUrl(file.name);

            if (!data.publicUrl) {
                return null;
            }

            const imageWorks =
                await checkImageCanOpen(data.publicUrl);

            if (!imageWorks) {
                console.log(
                    "Bozuk fotoğraf atlandı:",
                    file.name
                );

                return null;
            }

            const ownerId = file.name.includes("--")
                ? file.name.split("--")[0]
                : null;

            return {
                fileName: file.name,
                publicUrl: data.publicUrl,
                ownerId: ownerId
            };
        })
    );

    galleryPhotos = checkedPhotos.filter(function (photo) {
        return photo !== null;
    });

    gallery.innerHTML = "";
    galleryStatus.textContent = "";

    galleryPhotos.forEach(function (photo, index) {
        const item = document.createElement("button");
        item.className = "gallery-item";
        item.type = "button";

        const image = document.createElement("img");
        image.src = photo.publicUrl;
        image.alt = "Berfin ve Emre düğün hatırası";
        image.loading = "lazy";

        item.appendChild(image);

        item.addEventListener("click", function () {
            openLightbox(index);
        });

        if (
            currentUser &&
            photo.ownerId === currentUser.id
        ) {
            const deleteButton =
                document.createElement("button");

            deleteButton.type = "button";
            deleteButton.className =
                "gallery-delete-btn";

            deleteButton.textContent = "🗑️";

            deleteButton.setAttribute(
                "aria-label",
                "Fotoğrafı sil"
            );

            deleteButton.addEventListener(
                "click",
                async function (event) {
                    event.stopPropagation();

                    const confirmed = confirm(
                        "Bu fotoğrafı silmek istediğine emin misin?"
                    );

                    if (!confirmed) {
                        return;
                    }

                    deleteButton.disabled = true;

                    const { error } = await supabaseClient
                        .storage
                        .from(BUCKET_NAME)
                        .remove([photo.fileName]);

                    if (error) {
                        console.error(
                            "Fotoğraf silme hatası:",
                            error
                        );

                        alert("Fotoğraf silinemedi.");
                        deleteButton.disabled = false;
                        return;
                    }

                    closeLightbox();
                    await loadGallery();
                }
            );

            item.appendChild(deleteButton);
        }

        gallery.appendChild(item);
    });
}

function checkImageCanOpen(imageUrl) {
    return new Promise(function (resolve) {
        const testImage = new Image();

        testImage.onload = function () {
            resolve(true);
        };

        testImage.onerror = function () {
            resolve(false);
        };

        testImage.src = imageUrl;
    });
}


/*
=================================
LIGHTBOX
=================================
*/

function openLightbox(index) {
    currentPhotoIndex = index;
    updateLightboxPhoto();

    lightbox.classList.add("active");
    document.body.classList.add("lightbox-open");
}

function closeLightbox() {
    lightbox.classList.remove("active");
    document.body.classList.remove("lightbox-open");

    lightboxImage.src = "";
}

function updateLightboxPhoto() {
    if (galleryPhotos.length === 0) {
        return;
    }

    const currentPhoto =
        galleryPhotos[currentPhotoIndex];

    lightboxImage.src = currentPhoto.publicUrl;

    const shouldShowArrows =
        galleryPhotos.length > 1;

    lightboxPrev.hidden = !shouldShowArrows;
    lightboxNext.hidden = !shouldShowArrows;
}

function showNextPhoto() {
    if (galleryPhotos.length === 0) {
        return;
    }

    currentPhotoIndex =
        (currentPhotoIndex + 1) % galleryPhotos.length;

    updateLightboxPhoto();
}

function showPreviousPhoto() {
    if (galleryPhotos.length === 0) {
        return;
    }

    currentPhotoIndex =
        (
            currentPhotoIndex -
            1 +
            galleryPhotos.length
        ) % galleryPhotos.length;

    updateLightboxPhoto();
}

lightboxNext.addEventListener("click", function (event) {
    event.stopPropagation();
    showNextPhoto();
});

lightboxPrev.addEventListener("click", function (event) {
    event.stopPropagation();
    showPreviousPhoto();
});

lightboxClose.addEventListener("click", function (event) {
    event.stopPropagation();
    closeLightbox();
});

lightbox.addEventListener("click", function (event) {
    if (event.target === lightbox) {
        closeLightbox();
    }
});

document.addEventListener("keydown", function (event) {
    if (!lightbox.classList.contains("active")) {
        return;
    }

    if (event.key === "ArrowRight") {
        showNextPhoto();
    }

    if (event.key === "ArrowLeft") {
        showPreviousPhoto();
    }

    if (event.key === "Escape") {
        closeLightbox();
    }
});

lightbox.addEventListener(
    "touchstart",
    function (event) {
        touchStartX =
            event.changedTouches[0].screenX;
    },
    {
        passive: true
    }
);

lightbox.addEventListener(
    "touchend",
    function (event) {
        const touchEndX =
            event.changedTouches[0].screenX;

        const swipeDistance =
            touchEndX - touchStartX;

        if (Math.abs(swipeDistance) < 50) {
            return;
        }

        if (swipeDistance < 0) {
            showNextPhoto();
        } else {
            showPreviousPhoto();
        }
    },
    {
        passive: true
    }
);


/*
=================================
FOTOĞRAF İNDİRME
=================================
*/

downloadPhotoBtn.addEventListener(
    "click",
    async function (event) {
        event.stopPropagation();

        if (galleryPhotos.length === 0) {
            return;
        }

        const currentPhoto =
            galleryPhotos[currentPhotoIndex];

        downloadPhotoBtn.disabled = true;
        downloadPhotoBtn.textContent =
            "Hazırlanıyor...";

        try {
            const response =
                await fetch(currentPhoto.publicUrl);

            if (!response.ok) {
                throw new Error(
                    "Fotoğraf alınamadı."
                );
            }

            const imageBlob =
                await response.blob();

            const extension =
                imageBlob.type.split("/")[1] || "jpg";

            const fileName =
                `berfin-emre-dugun-${Date.now()}.${extension}`;

            const imageFile = new File(
                [imageBlob],
                fileName,
                {
                    type: imageBlob.type
                }
            );

            const canShareFile =
                navigator.share &&
                navigator.canShare &&
                navigator.canShare({
                    files: [imageFile]
                });

            if (canShareFile) {
                await navigator.share({
                    files: [imageFile],
                    title: "Berfin & Emre Düğün Fotoğrafı"
                });
            } else {
                const temporaryUrl =
                    URL.createObjectURL(imageBlob);

                const downloadLink =
                    document.createElement("a");

                downloadLink.href = temporaryUrl;
                downloadLink.download = fileName;

                document.body.appendChild(downloadLink);
                downloadLink.click();
                downloadLink.remove();

                setTimeout(function () {
                    URL.revokeObjectURL(temporaryUrl);
                }, 1000);
            }
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error(
                    "Fotoğraf kaydetme hatası:",
                    error
                );

                alert(
                    "Fotoğraf kaydedilemedi. Lütfen tekrar deneyin."
                );
            }
        } finally {
            downloadPhotoBtn.disabled = false;
            downloadPhotoBtn.textContent =
                "⬇️ Galeriye Kaydet";
        }
    }
);


/*
=================================
KELİME SAYACI
=================================
*/

function countWords(text) {
    const cleanedText = text.trim();

    if (cleanedText === "") {
        return 0;
    }

    return cleanedText
        .split(/\s+/)
        .filter(function (word) {
            return word.length > 0;
        })
        .length;
}

memoryText.addEventListener("input", function () {
    const wordCount =
        countWords(memoryText.value);

    memoryWordCount.textContent =
        `${wordCount} / ${MAX_MEMORY_WORDS} kelime`;

    const wordLimitExceeded =
        wordCount > MAX_MEMORY_WORDS;

    memoryWordCount.classList.toggle(
        "limit-exceeded",
        wordLimitExceeded
    );

    memorySubmitBtn.disabled =
        wordLimitExceeded;
});


/*
=================================
ANI GÖNDERME
=================================
*/

memoryForm.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const name = memoryName.value.trim();
        const memory = memoryText.value.trim();
        const wordCount = countWords(memory);

        memoryFormStatus.className =
            "memory-form-status";

        if (name === "") {
            memoryFormStatus.textContent =
                "❌ Lütfen adınızı yazın.";

            memoryFormStatus.classList.add("error");
            return;
        }

        if (memory === "") {
            memoryFormStatus.textContent =
                "❌ Lütfen anınızı veya dileğinizi yazın.";

            memoryFormStatus.classList.add("error");
            return;
        }

        if (wordCount > MAX_MEMORY_WORDS) {
            memoryFormStatus.textContent =
                "❌ Anınız en fazla 200 kelime olabilir.";

            memoryFormStatus.classList.add("error");
            return;
        }

        memorySubmitBtn.disabled = true;
        memorySubmitBtn.textContent =
            "Panoya ekleniyor...";

        const { error } = await supabaseClient
            .from("anilar")
            .insert({
                isim: name,
                ani: memory,
                user_id: currentUser.id
            });

        if (error) {
            console.error("Anı ekleme hatası:", error);

            memoryFormStatus.textContent =
                "❌ Anı eklenemedi. Lütfen tekrar deneyin.";

            memoryFormStatus.classList.add("error");

            memorySubmitBtn.disabled = false;
            memorySubmitBtn.textContent =
                "💌 Anıyı Panoya Bırak";

            return;
        }

        memoryFormStatus.textContent =
            "💗 Anınız panoya eklendi!";

        memoryFormStatus.classList.add("success");

        memoryText.value = "";
        memoryWordCount.textContent =
            "0 / 200 kelime";

        memorySubmitBtn.disabled = false;
        memorySubmitBtn.textContent =
            "💌 Anıyı Panoya Bırak";

        await loadMemories();
    }
);


/*
=================================
ANILARI GÖSTERME
=================================
*/

async function loadMemories() {
    memoryBoardStatus.textContent =
        "Anılar yükleniyor...";

    const { data: memories, error } =
        await supabaseClient
            .from("anilar")
            .select("id, isim, ani, created_at, user_id")
            .order("created_at", {
                ascending: false
            });

    if (error) {
        console.error("Anıları getirme hatası:", error);

        memoryBoardStatus.textContent =
            "Anılar şu anda görüntülenemiyor.";

        return;
    }

    memoryBoard.innerHTML = "";

    if (memories.length === 0) {
        memoryBoardStatus.textContent =
            "Henüz anı bırakılmadı. İlk anıyı siz bırakın.";

        memoryCount.textContent = "";
        return;
    }

    memoryBoardStatus.textContent = "";
    memoryCount.textContent =
        `${memories.length} anı`;

    memories.forEach(function (memory) {
        const card =
            document.createElement("article");

        card.className = "memory-card";

        const quote =
            document.createElement("div");

        quote.className = "memory-quote";
        quote.textContent = "“";

        const text =
            document.createElement("p");

        text.className = "memory-card-text";
        text.textContent = memory.ani;

        const footer =
            document.createElement("footer");

        footer.className = "memory-card-footer";

        const name =
            document.createElement("strong");

        name.textContent = memory.isim;

        const date =
            document.createElement("time");

        date.dateTime = memory.created_at;
        date.textContent =
            formatMemoryDate(memory.created_at);

        footer.appendChild(name);
        footer.appendChild(date);

        card.appendChild(quote);
        card.appendChild(text);
        card.appendChild(footer);

        if (
            currentUser &&
            memory.user_id === currentUser.id
        ) {
            const deleteButton =
                document.createElement("button");

            deleteButton.type = "button";
            deleteButton.className = "memory-delete-btn";
            deleteButton.textContent = "🗑️ Yazımı Sil";

            deleteButton.addEventListener(
                "click",
                async function () {
                    const confirmed = confirm(
                        "Bu anıyı silmek istediğine emin misin?"
                    );

                    if (!confirmed) {
                        return;
                    }

                    deleteButton.disabled = true;
                    deleteButton.textContent = "Siliniyor...";

                    const { error } = await supabaseClient
                        .from("anilar")
                        .delete()
                        .eq("id", memory.id);

                    if (error) {
                        console.error(
                            "Anı silme hatası:",
                            error
                        );

                        alert("Anı silinemedi.");

                        deleteButton.disabled = false;
                        deleteButton.textContent =
                            "🗑️ Yazımı Sil";

                        return;
                    }

                    await loadMemories();
                }
            );

            card.appendChild(deleteButton);
        }

        memoryBoard.appendChild(card);
    });
}

function formatMemoryDate(dateString) {
    return new Intl.DateTimeFormat(
        "tr-TR",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    ).format(new Date(dateString));
}


/*
=================================
SAYFA AÇILINCA
=================================
*/

(async function () {
    currentUser = await ensureAnonymousUser();

    if (!currentUser) {
        alert("Kullanıcı bağlantısı kurulamadı.");
        return;
    }

    await loadGallery();
    await loadMemories();
})();