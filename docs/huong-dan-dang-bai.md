# Hướng dẫn đăng nội dung — Ngoaingu3k

Tài liệu này đi từng bước, từng nút bấm, cho tất cả các loại nội dung đăng lên hệ thống:
khóa học, bài học, các dạng bài tập, bài nghe, luyện nét chữ, flashcard và đề thi.

Tên nút và tên ô trong tài liệu là **đúng y như trên màn hình**, nên bạn có thể dò theo từng chữ.

---

## Mục lục

| Phần | Nội dung | Ai làm được |
|---|---|---|
| [0](#0-trước-khi-bắt-đầu) | Trước khi bắt đầu | Tất cả |
| [1](#1-đăng-một-khóa-học-mới) | Đăng một khóa học mới | Giảng viên, Admin |
| [2](#2-ba-cách-tạo-nội-dung-bài-học) | Ba cách tạo nội dung bài học | Giảng viên, Admin |
| [3](#3-chỉnh-từng-bài-học-trong-màn-confirm) | Chỉnh từng bài học trong màn Confirm | Giảng viên, Admin |
| [4](#4-tab-bài-tập-trong-một-chủ-đề) | Tab bài tập trong một chủ đề | Giảng viên, Admin |
| [5](#5-các-dạng-câu-hỏi-trong-bài-học) | Các dạng câu hỏi trong bài học | Giảng viên, Admin |
| [6](#6-bài-nghe-và-tốc-độ-audio) | Bài nghe và tốc độ audio | Giảng viên, Admin |
| [7](#7-luyện-nét-chữ-hsk) | Luyện nét chữ (HSK) | Tự động |
| [8](#8-flashcard) | Flashcard | Giảng viên, Admin |
| [9](#9-đề-thi) | Đề thi | Giảng viên, Admin |
| [10](#10-phần-dành-cho-admin) | Phần dành riêng cho Admin | Admin |
| [11](#11-giới-hạn-file-và-lỗi-hay-gặp) | Giới hạn file và lỗi hay gặp | Tất cả |

---

## 0. Trước khi bắt đầu

1. Đăng nhập tại **Đăng nhập** (góc phải trên cùng).
2. Kiểm tra vai trò của bạn — menu trên đầu trang sẽ khác nhau:

| Vai trò | Menu nhìn thấy |
|---|---|
| Học viên | Trang chủ · Khóa học tiếng Anh · Khóa học tiếng Trung · Phòng học · Phòng thi · **Bài tập** · Liên hệ |
| Giảng viên | … · Phòng học · Phòng thi · **Tiến độ học sinh** · **Bảng điều khiển** · Liên hệ |
| Admin | Như giảng viên, nhưng **Bảng điều khiển** mở ra trang quản trị toàn hệ thống |

3. Nơi làm việc chính của giảng viên là **Bảng điều khiển** (`/dashboard/teacher`).
   Trên đó có 2 khu riêng biệt, cuộn từ trên xuống:
   - **Khóa đang vận hành** + **Quản lý khóa học** → đăng khóa và bài học.
   - **Đề thi & kết quả** → soạn đề thi và xem điểm học viên.

4. Flashcard nằm ở chỗ khác: **rê chuột vào "Phòng học"** trên thanh menu, một menu con sẽ xổ ra:

   | Mục | Đi tới | Ai thấy |
   |---|---|---|
   | Phòng học | `/learn` — video bài giảng và bài tập | Tất cả |
   | Flashcard | `/flashcards` — Thẻ ghi nhớ, Học, Kiểm tra, Ghép cặp | Tất cả |
   | Tạo flashcard | `/flashcards?create=1` — nhập bộ thẻ mới | **Chỉ giảng viên và admin** |

> **Lưu ý quan trọng xuyên suốt tài liệu:** bạn chỉ thao tác được trên **khóa học do chính bạn phụ trách**.
> Đây không phải là hạn chế của giao diện mà là quy tắc bảo mật ở tầng cơ sở dữ liệu (RLS) —
> nếu cố lưu vào khóa của người khác, hệ thống sẽ báo lỗi từ chối. Admin là người gắn giảng viên vào khóa.

---

## 1. Đăng một khóa học mới

**Bảng điều khiển → nút `Đăng khóa học mới`** (nút màu, nằm ngay đầu khu "Khóa đang vận hành").

Nếu bạn muốn sửa khóa đã có: bấm vào khóa trong danh sách rồi bấm `Chỉnh sửa`,
hoặc dùng ô **Khóa đang sửa** ở đầu form và chọn tên khóa (chọn `Tạo khóa mới` để quay lại tạo mới).

### 1.1. Điền thông tin khóa

| Ô | Bắt buộc | Ghi chú |
|---|---|---|
| **Tên khóa học** | ✅ | VD: `Tiếng Anh giao tiếp nền tảng`. Đây là ô quyết định nút đăng có bật hay không. |
| **Nhóm nội dung** | | Chọn: Kỹ năng cốt lõi · Giao tiếp · Công sở · Luyện thi |
| **Trình độ** | | Chọn: Nền tảng · Trung cấp · Nâng cao |
| **Thời lượng** | | Chữ tự do, VD: `6 tuần` |
| **Số bài học** | | Số hiển thị trên thẻ khóa học ngoài trang danh mục |
| **Giá bán VND** | | Điền `0` nếu miễn phí |
| **Tổng số buổi trong gói** | | Để trống nếu không giới hạn |
| **Thời hạn gói (tháng)** | | Để trống nếu không giới hạn |
| **Mô tả khóa học** | | Mục tiêu, lộ trình, kết quả đạt được |
| **Ảnh đại diện** | | Chọn file ảnh; chờ dòng `Đang tải ảnh lên...` biến mất rồi mới đi tiếp |

### 1.2. Chọn cách tạo nội dung

Ngay dưới phần mô tả có ô **Cách tạo nội dung** với 3 lựa chọn: **Google Drive**, **Excel**, **Nhập thủ công**.
Xem chi tiết từng cách ở phần 2.

### 1.3. Đăng

Cuộn xuống cuối form, bấm:

- **`Confirm và đăng bài`** — khi tạo khóa mới
- **`Cập nhật khóa học`** — khi đang sửa khóa cũ

Sau khi đăng, khóa xuất hiện trong **Khóa đang vận hành**. Tại đó bạn còn có:
`Chỉnh sửa` · `Ẩn / Công khai` (bật tắt trạng thái) · `Xóa khóa`.

---

## 2. Ba cách tạo nội dung bài học

### 2.1. Cách A — Danh sách video Google Drive *(nhanh nhất cho khóa có sẵn video)*

1. Ở ô **Cách tạo nội dung**, chọn **Google Drive**.
2. Dán vào ô **Danh sách video Google Drive**, mỗi dòng một mục:

```
Chương 1. Chào hỏi
https://drive.google.com/file/d/1AbCdEf.../view
https://drive.google.com/file/d/1GhIjKl.../view
Chương 2. Lịch trình hằng ngày
https://drive.google.com/file/d/1MnOpQr.../view
```

**Quy tắc đọc:**
- Dòng **có link** → tạo **1 bài học**.
- Dòng **không có link** → tạo **1 chương mới**, các bài phía dưới thuộc chương đó.

3. Bấm nút nhập. Hệ thống dựng sẵn cây chương/bài để bạn xem lại ở phần 3.

> ⚠️ **Bắt buộc mở quyền cho video**, nếu không học viên sẽ thấy khung video báo lỗi 403:
> Trong Google Drive → chuột phải file → **Share** → **General access** → **Anyone with the link** → **Viewer**.
>
> ⚠️ Phải là **link của file video**, không phải link thư mục.
> Dạng đúng: `/file/d/.../view`, `/open?id=...` hoặc `/uc?id=...`.

### 2.2. Cách B — Nhập khóa học bằng Excel *(khi đã có ngân hàng câu hỏi)*

1. Ở ô **Cách tạo nội dung**, chọn **Excel**.
2. Bấm ô **Nhập khóa học bằng Excel** và chọn file `.xls` hoặc `.xlsx`.

**Cấu trúc file:**

- **Mỗi sheet = một chương.** Tên sheet chính là tên chương.
- Dòng đầu là dòng tiêu đề. Hệ thống nhận ra dòng tiêu đề nếu nó chứa một trong các chữ:
  `Tên bài`, `Dạng bài`, `Đáp án`.
- Các cột theo đúng thứ tự sau:

| Cột | Nội dung | Ví dụ |
|---|---|---|
| **A** | Tên bài | `Bài 1. Giới thiệu bản thân` |
| **B** | Số bài | `1` |
| **C** | Dạng bài | `Luyện tập ngữ âm` |
| **D** | Câu số | `1` |
| **E** | Lựa chọn A | `nǐ hǎo` |
| **F** | Lựa chọn B | `ní hào` |
| **G** | Lựa chọn C | `nì hāo` |
| **H** | Lựa chọn D | `nī hǎo` |
| **I** | Đáp án | `A` — hoặc gõ đúng nội dung đáp án |
| **J** | Ghi chú / giải thích | `Thanh 3 + thanh 3 đọc thành thanh 2` |

**Cách hệ thống cắt bài:** ba cột A, B, C đổi giá trị là bắt đầu **một bài mới**.
Các dòng tiếp theo chỉ điền D–J sẽ được gom vào bài đang mở. Nghĩa là bạn chỉ cần
ghi tên bài **một lần** ở dòng câu đầu tiên, các câu sau để trống A–C.

**Cột I (Đáp án)** chấp nhận cả hai kiểu: gõ nhãn `A`/`B`/`C`/`D`, hoặc gõ nguyên văn nội dung đáp án.
Nếu ô lựa chọn của bạn đã có sẵn tiền tố kiểu `A. nǐ hǎo` thì hệ thống tự tách nhãn ra, không bị lặp.

### 2.3. Cách C — Nhập bài học thủ công

1. Ở ô **Cách tạo nội dung**, chọn **Nhập thủ công**.
2. Điền **Tên chương** và số bài muốn tạo.
3. Bấm nút tạo — hệ thống dựng khung bài trống để bạn điền tiếp ở phần 3.

---

## 3. Chỉnh từng bài học trong màn Confirm

Sau khi nhập bằng bất kỳ cách nào ở trên, khu **Confirm nội dung — "Xem, sửa và kiểm tra bài học trước khi đăng"**
sẽ hiện ra. Đây là nơi bạn hoàn thiện nội dung.

### 3.1. Sắp xếp chương và bài

- **Đổi thứ tự chương:** giữ và kéo thẻ chương (có chú thích *"Giữ và kéo để đổi vị trí chương"*).
- **Đổi thứ tự bài:** kéo thả bài trong dải bài của chương.
- **`+ Thêm chương mới`** — thêm chương ở cuối.
- **`+ Thêm bài vào cuối`** — thêm bài vào cuối chương.
- **`Xóa`** trên thẻ chương — xóa cả chương.
- Nút xóa trên bài (*"Xóa bài học"*) — xóa một bài.
- Sửa tên chương: gõ trực tiếp vào ô **Tên chương**.

### 3.2. Sửa nội dung một bài

Bấm vào bài để mở khung **Sửa bài học**:

| Ô | Ý nghĩa |
|---|---|
| **Tên bài** | Tên hiển thị cho học viên |
| **Dạng bài** | Chọn có sẵn hoặc tự gõ. Chữ này hiện làm tiêu đề khu bài tập của học viên |
| **Ghi chú bài học** | Ghi chú ngắn hiện dưới tên bài |
| **Video bài học từ Google Drive** | Dán link share. Dòng gợi ý bên dưới báo ngay nếu link sai kiểu. Link không phải Drive vẫn nhận (hiện là `Video URL`), nhưng Drive là đường đã kiểm chứng |
| **File nghe nếu có** | Chọn file audio cho cả bài |
| **Ảnh nếu có** | Chọn file ảnh cho cả bài |

> Ô video ghi thẳng vào **tab Video** của chủ đề, nên video và tab không bao giờ lệch nhau.

---

## 4. Tab bài tập trong một chủ đề

Mỗi bài học là **một chủ đề**. Khi học viên mở chủ đề, họ thấy **hai phần độc lập**:
**Video** và **Bài tập**. Bấm vào **Bài tập** mới trải ra các tab bài tập con — để không rối mắt.

Một chủ đề có thể có **1 tab video + nhiều tab bài tập** (7–8 tab là bình thường).

### Các thao tác — khu "Tab bài tập của chủ đề"

| Thao tác | Cách làm |
|---|---|
| Thêm tab | Bấm **`+ Thêm tab`** |
| Đặt tên tab | Gõ trực tiếp vào ô tên, VD: `Bài tập ngữ pháp 1`, `Bài tập nghe 2` |
| Chọn tab để soạn câu hỏi | Bấm vào **số thứ tự** của tab |
| Đổi vị trí tab | Bấm mũi tên trái / phải trên thẻ tab |
| Xóa tab | Bấm **`Xóa`** trên thẻ tab |

Con số nhỏ trên mỗi thẻ tab là **số câu hỏi** tab đó đang có.

> Đặt tên rõ ràng để học viên nhận diện được ngay — đó là toàn bộ mục đích của cơ chế nhiều tab.

---

## 5. Các dạng câu hỏi trong bài học

Trong khu **Câu hỏi · <tên tab>** có hai cách thêm câu:

- **`Nhập Excel`** — chọn file `.xls`/`.xlsx`, các câu được nạp thẳng vào tab đang chọn.
- **`Thêm thủ công`** — tạo một câu trống rồi tự điền.

Với mỗi câu bạn có: **Nội dung câu**, các ô **Lựa chọn A/B/C/D**, nút **`Thêm lựa chọn`** (tối đa 4),
ô **Đáp án đúng** (chọn nhãn A/B/C/D) và nút **`Xóa câu`**.

### 5.1. File Excel chỉ chứa câu hỏi

Khác với file cả khóa ở mục 2.2, file này chỉ cần các cột câu hỏi. Hệ thống tự dò tiêu đề cột theo tên:

| Cột | Tên tiêu đề chấp nhận |
|---|---|
| Câu hỏi | `Câu hỏi`, `Question`, `Prompt`, `Nội dung` |
| Lựa chọn | `A`, `B`, `C`, `D` — hoặc `Lựa chọn A`, `Option A`… |
| Đáp án | `Đáp án`, `Answer`, `Correct` |
| Giải thích | `Giải thích`, `Ghi chú`, `Note`, `Explanation` |

Nếu file không có dòng tiêu đề, hệ thống vẫn cố đọc theo vị trí cột (câu hỏi → 4 lựa chọn → đáp án → ghi chú).

### 5.2. Sáu dạng câu hỏi và cách chấm điểm

| Dạng | Dùng khi | Cần điền gì | Chấm điểm |
|---|---|---|---|
| **Trắc nghiệm** | Mặc định, phổ biến nhất | Nội dung câu + các lựa chọn + đáp án đúng | 1 điểm nếu chọn đúng nhãn |
| **Đúng / Sai** | Kiểm tra nhận định | Nội dung câu + đáp án `Đúng` hoặc `Sai` | 1 điểm |
| **Điền khuyết** | Điền từ vào chỗ trống | Đáp án; có thể khai nhiều đáp án được chấp nhận | 1 điểm. **Bỏ qua hoa/thường, dấu câu và khoảng trắng thừa** |
| **Nối cặp** | Nối từ với nghĩa | Danh sách cặp trái–phải | **Mỗi cặp đúng 1 điểm** (câu 5 cặp = 5 điểm) |
| **Nghe & gõ lại** | Nghe rồi chép lại | File audio + đáp án | 1 điểm, chấm dễ như Điền khuyết |
| **Viết (tự luận)** | Viết đoạn, luyện diễn đạt | Câu hỏi + bài mẫu (không bắt buộc) | **Không tính điểm** — không chấm tự động được |

**Ba điều cần nhớ về điểm:**

1. Câu **Viết (tự luận)** và câu **thiếu dữ liệu đáp án** đều bị **loại khỏi tổng điểm**,
   chứ không bị tính 0 điểm. Học viên không bị trừ oan.
2. Điểm này chính là **số sao** của bài trong danh sách bài học:
   **≥ 80% → 3 sao · ≥ 50% → 2 sao · dưới đó → 1 sao**.
3. Bài **không có gì để chấm** (bài chỉ có video, mục lục, bài đọc) thì **hoàn thành là được đủ 3 sao** —
   nếu không, bài xem xong sẽ trông y hệt bài làm sai.

**Cúp của chương** tính theo tổng sao đạt được trên tổng sao tối đa của chương:
**≥ 90% → 3 cúp · ≥ 60% → 2 cúp · dưới đó → 1 cúp.**

---

## 6. Bài nghe và tốc độ audio

### 6.1. Đăng bài nghe

Có hai chỗ gắn audio, dùng cho hai mục đích khác nhau:

- **File nghe của cả bài** — ô **File nghe nếu có** trong khung Sửa bài học (mục 3.2).
  Dùng khi nhiều câu cùng nghe một đoạn.
- **File nghe của từng câu** — dùng cho dạng **Nghe & gõ lại**.

### 6.2. Học viên chỉnh tốc độ

Với bài nghe **tua được**, học viên thấy thanh chọn tốc độ: **0,5× · 0,75× · 1× · 1,25× · 1,5×**.

- Tốc độ đã chọn được **nhớ lại** cho các bài nghe sau, kể cả khi thoát ra vào lại.
- Có ở **cả phần học lẫn phòng thi**.
- Giọng đọc **không bị méo** khi đổi tốc độ.
- ❌ Dạng **click-to-listen** (bấm để nghe từng từ) **không có** thanh tốc độ — đúng thiết kế,
  vì đó là âm thanh ngắn phát bằng giọng máy, không phải file tua được.

---

## 7. Luyện nét chữ (HSK)

Đây là chức năng **tự động — bạn không phải đăng gì cả**.

- Trong phòng học của **bất kỳ khóa tiếng Trung nào**, mục **"Luyện nét chữ"** được **ghim ở đầu cột trái**,
  nằm trên toàn bộ danh sách bài học.
- Hệ thống nhận diện khóa tiếng Trung qua tên hoặc đường dẫn của khóa có chứa
  `hsk`, `trung`, `hoa` hoặc `chinese`. Đặt tên khóa theo đó là chức năng tự bật.
- Bài luyện có sẵn **24 nét chữ Hán**, mỗi nét kèm tên tiếng Việt, tên tiếng Trung, phiên âm, chữ ví dụ
  và mẹo viết. Hình nét được **vẽ bằng SVG ngay trong ứng dụng** — không cần upload ảnh, không bao giờ vỡ hình.

**Nếu bạn muốn tự ra đề về nét chữ trong bài tập thường:** viết câu hỏi có chữ **"nét"**
và để đáp án đúng là **tên tiếng Việt của nét** (VD: `nét ngang`, `nét sổ móc`).
Hệ thống sẽ tự vẽ đúng hình nét đó vào câu hỏi.

---

## 8. Flashcard

Nhập bộ thẻ hoạt động **y như Quizlet**: dán một cục text, chọn dấu phân cách, xem trước, rồi nhập.

### 8.1. Nhập bộ thẻ

1. Rê chuột vào **Phòng học** → bấm **Tạo flashcard**.
2. Chọn **Khóa học** — danh sách chỉ hiện **khóa bạn phụ trách**.
   Nếu thấy dòng *"Bạn chưa phụ trách khóa học nào"* thì nhờ admin gắn khóa cho bạn trước.
3. Điền **Tên bộ thẻ** (VD: `HSK 1 — Chủ đề 1`) và **Mô tả** (không bắt buộc).
4. Dán danh sách vào ô **Dán nội dung** — copy thẳng từ Excel, Google Sheets hay Word đều được.
5. Chọn dấu phân cách:

| Nhóm | Lựa chọn |
|---|---|
| **Giữa thuật ngữ và định nghĩa** | Tab · Dấu phẩy · Gạch ngang · Tuỳ chỉnh |
| **Giữa các thẻ** | Xuống dòng · Chấm phẩy · Tuỳ chỉnh |

Chọn **Tuỳ chỉnh** sẽ hiện thêm ô để bạn tự gõ ký tự, VD `::` hoặc `||`.

6. Xem khu **Xem trước — N thẻ**. Kiểm tra kỹ hai cảnh báo nếu có:
   - *"N dòng thiếu dấu phân cách"* → những dòng đó bị bỏ, sửa lại rồi dán lại.
   - *"Đã cắt bớt do quá nhiều dòng"* → đã chạm trần **2000 thẻ**, hãy tách thành nhiều bộ.
7. Bấm **`Nhập bộ thẻ`**.

**Ví dụ dán (dấu phân cách: Tab + Xuống dòng):**

```
你好	xin chào
谢谢	cảm ơn
再见	tạm biệt
```

> 💡 Mẹo: chỉ **lần xuất hiện đầu tiên** của dấu phân cách được dùng để cắt.
> Nên khi tách bằng dấu phẩy, định nghĩa `mời, xin mời` vẫn giữ nguyên cả dấu phẩy bên trong.

### 8.2. Học viên học bằng gì

Vào **Phòng học → Flashcard**, chọn bộ thẻ, rồi chọn 1 trong 4 chế độ:

| Chế độ | Cách hoạt động |
|---|---|
| **Thẻ ghi nhớ** | Lật thẻ hai mặt, có hiệu ứng lật 3D, đảo được mặt hiện trước |
| **Học** | Thẻ mới hỏi **trắc nghiệm**; đúng được 1 lần thì thẻ đó chuyển sang **gõ đáp án**. Thuộc = đúng liên tiếp 2 lần |
| **Kiểm tra** | Ra đề trộn nhiều dạng, làm hết rồi nộp một lần |
| **Ghép cặp** | Bấm nối thuật ngữ với định nghĩa cho hết bảng |

Có tiếng đúng/sai, và **pháo hoa + nhạc chúc mừng** khi hoàn thành trọn bộ.
Học viên tắt tiếng được bằng nút loa; lựa chọn đó được nhớ cho lần sau.
Tiến độ thuộc bài được lưu theo tài khoản.

---

## 9. Đề thi

**Bảng điều khiển → cuộn xuống khu "Đề thi & kết quả" → nút `Tạo đề thi mới`.**

### 9.1. Thông tin chung

| Ô | Ghi chú |
|---|---|
| **Tên đề thi** | VD: `Thi thử IELTS Listening + Reading tháng 8` |
| **Mô tả (tùy chọn)** | Ghi chú ngắn cho học viên |
| **Phạm vi giao đề** | `Học viên chỉ định (theo email)` hoặc `Học viên đã mua khóa` |
| **Khóa học áp dụng** | Hiện khi chọn "Học viên đã mua khóa" |
| **Email học viên** | Hiện khi chọn "Học viên chỉ định" — **mỗi dòng một email** |

### 9.2. Thêm các phần thi

Dùng nút **`+ Thêm phần Nghe`** hoặc **`+ Thêm phần Đọc`**. Mặc định đề mới có sẵn 1 phần Nghe + 1 phần Đọc.

Mỗi phần cần:

| Ô | Phần Nghe | Phần Đọc |
|---|---|---|
| **Tên phần thi** | VD: `Phần nghe` | VD: `Phần đọc` |
| **Thời gian (phút)** | Mặc định 30 | Mặc định 45 |
| Nội dung | **`Chọn file âm thanh`** để upload, hoặc ô **Hoặc dán link audio**. Sau khi tải xong, bấm **`Dùng làm thời gian phần thi`** để lấy đúng độ dài file làm thời gian | Ô **Bài đọc** — dán văn bản, **phân đoạn bằng dòng trống** |

### 9.3. Thêm câu hỏi

Trong mỗi phần, bấm nút thêm câu. Mỗi câu chọn 1 trong 4 dạng:

| Dạng | Cần điền |
|---|---|
| **Trắc nghiệm** | Ô **Các lựa chọn (mỗi dòng một lựa chọn)** + chọn **Đáp án đúng** |
| **Đúng / Sai** | Chọn **Đúng** hoặc **Sai** |
| **Điền đáp án** | Ô **Đáp án chấp nhận (phân cách bằng dấu phẩy)**, VD: `hello world, hello-world` |
| **Nối cặp** | Ô **Các cặp nối**, mỗi dòng viết `Vế trái = Vế phải` |

Mỗi câu còn có: ảnh minh họa (upload) và ô **Giải thích** — giải thích chỉ hiện ra **sau khi học viên nộp bài**.

### 9.4. Lưu và mở đề

| Nút | Kết quả |
|---|---|
| **`Lưu bản nháp`** | Lưu lại, học viên **chưa** thấy |
| **`Lưu & mở cho học viên`** | Lưu và mở đề ngay |

Trong danh sách đề sau đó: `Sửa` · **`Mở đề` / `Đóng đề`** · `Xóa`.
Nhãn trạng thái là **Đang mở** / **Bản nháp** / **Lưu trữ**.

> 💡 Bản nháp được **tự động lưu tạm trên máy bạn** trong lúc soạn — đóng nhầm trình duyệt vẫn khôi phục được.
> Khi mở lại sẽ có dòng *"Bạn có một đề thi đang soạn dở"* kèm nút khôi phục hoặc bỏ.
>
> ⚠️ Nếu thấy cảnh báo *"Bản nháp quá lớn để tự động lưu"* → đề đang nhúng ảnh/audio quá nặng.
> Hãy bấm **`Lưu bản nháp`** thủ công để không mất công.

### 9.5. Xem kết quả

Ngay dưới danh sách đề là bảng **Lượt nộp bài của học viên**:
Học viên · Đề thi · Điểm · Từng phần · Trạng thái · Nộp lúc.

---

## 10. Phần dành cho Admin

**Bảng điều khiển admin** (`/dashboard/admin`) có các tab:
`📊 Tổng quan` · `💳 Thanh toán` · `👥 Người dùng` · `📝 Đề thi` · `📋 Lịch sử hoạt động`.

### 10.1. Thêm / sửa / xóa khóa học (toàn hệ thống)

| Ô | Ghi chú |
|---|---|
| **Tên khóa** | |
| **Slug** | Để trống thì tự sinh. Slug là phần trên thanh địa chỉ, VD `hsk-1-vo-long` |
| **Giảng viên phụ trách** | **Quan trọng** — chưa gắn giảng viên thì người đó không nhập được flashcard cho khóa |
| **Trạng thái** | `Nháp` · `Công khai` · `Ẩn` |
| **Giá VND** | |
| **Ảnh đại diện (banner)** | Upload file hoặc dán URL ảnh |
| **Mô tả** | |

### 10.2. Thay đổi, thêm, sửa, xóa bài học

| Ô | Ghi chú |
|---|---|
| **Khóa học** | Chọn khóa chứa bài |
| **Tên bài học** | |
| **Thứ tự** | Vị trí bài trong khóa |
| **Video URL** | Dán link |
| **Tải video lên Storage** | Upload trực tiếp, có thanh phần trăm |
| **Nội dung bài** | |
| **Cho xem thử** | Cho người chưa mua khóa xem bài này |

---

## 11. Giới hạn file và lỗi hay gặp

### 11.1. Giới hạn dung lượng

| Loại file | Tối đa |
|---|---|
| Video | **500 MB** |
| Ảnh | **30 MB** |
| Audio | **100 MB** |
| Số thẻ mỗi bộ flashcard | **2000 thẻ** |

Ảnh nhận: `.jpg` `.png` `.webp` `.gif` · Video nhận: `.mp4` `.webm` `.mov` `.mkv`

### 11.2. Bảng lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Khung video báo **403** | File Drive chưa mở quyền | Drive → Share → General access → **Anyone with the link** → **Viewer** |
| Báo *"Bạn đang dán link thư mục Google Drive"* | Dán nhầm link folder | Mở đúng file video, copy link Share của **file** |
| Nhập Excel ra 0 bài | Thiếu dòng tiêu đề | Thêm dòng tiêu đề có chữ `Tên bài`, `Dạng bài` hoặc `Đáp án` |
| Nhập Excel gộp hết vào 1 bài | Cột A/B/C không đổi giá trị | Ghi tên bài mới ở dòng câu đầu tiên của bài đó |
| Flashcard: **không lưu được, báo từ chối** | Bạn không phụ trách khóa đã chọn | Nhờ admin gắn bạn vào khóa ở mục **Giảng viên phụ trách** |
| Flashcard: *"Bạn chưa phụ trách khóa học nào"* | Chưa được gắn khóa nào | Như trên |
| Dán 50 dòng nhưng chỉ ra 48 thẻ | 2 dòng thiếu dấu phân cách | Đọc cảnh báo *"N dòng thiếu dấu phân cách"*, sửa rồi dán lại |
| Bài học viên làm xong nhưng **0 sao** | Bài không có câu chấm điểm được | Bình thường — bài không chấm được thì hoàn thành là đủ 3 sao. Nếu vẫn 0 sao, kiểm tra câu hỏi đã có đáp án đúng chưa |
| Bài nghe **không có thanh tốc độ** | Đó là dạng click-to-listen | Đúng thiết kế, chỉ bài nghe tua được mới có |
| Không thấy **Tạo flashcard** trong menu | Đang đăng nhập bằng tài khoản học viên | Đăng nhập lại bằng tài khoản giảng viên hoặc admin |
| Không thấy mục **Luyện nét chữ** | Tên/slug khóa không chứa `hsk`, `trung`, `hoa`, `chinese` | Đổi tên khóa hoặc slug cho khớp |

---

## 12. Quy trình chuẩn — đăng một khóa hoàn chỉnh

Bảng dưới là trình tự khuyến nghị, làm theo là không sót bước nào:

| # | Việc | Ở đâu |
|---|---|---|
| 1 | Admin tạo khóa và **gắn giảng viên phụ trách** | Bảng điều khiển admin |
| 2 | Giảng viên điền thông tin khóa + ảnh banner | Bảng điều khiển → Đăng khóa học mới |
| 3 | Nhập nội dung bằng Drive / Excel / thủ công | Ô **Cách tạo nội dung** |
| 4 | Sắp lại chương và bài bằng kéo thả | Khu **Confirm nội dung** |
| 5 | Với từng bài: đặt tên, gắn video, gắn audio | Khung **Sửa bài học** |
| 6 | Tạo các tab bài tập và **đặt tên dễ nhận diện** | Khu **Tab bài tập của chủ đề** |
| 7 | Soạn câu hỏi cho từng tab | Khu **Câu hỏi · <tên tab>** |
| 8 | Bấm **`Confirm và đăng bài`** | Cuối form |
| 9 | Nhập flashcard cho khóa | Phòng học → Tạo flashcard |
| 10 | Soạn đề thi và **`Lưu & mở cho học viên`** | Khu **Đề thi & kết quả** |
| 11 | Kiểm tra bằng mắt học viên | Đăng nhập tài khoản học viên, vào Phòng học |

> Bước 11 đừng bỏ: đây là bước duy nhất phát hiện được video khóa quyền, audio thiếu file,
> hay câu hỏi không có đáp án đúng.
