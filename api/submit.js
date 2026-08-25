import { google } from 'googleapis';
import { Readable } from 'stream';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ status: 'error', message: 'Only POST requests allowed' });
    }

    try {
        const data = req.body;

        const regType = data.registrationType || "";
        const fullName = data.fullName || "";
        const friendName = data.friendName || "";
        const entity = data.entity || "";
        const governorate = data.governorate || "";
        const isFollowingFb = data.isFollowingFb || "";
        const namesOnCertificates = data.namesOnCertificates || "";
        const files = data.files || {};

        // جدول الفولدرات والشيتات لكل كيان
        const entityConfig = {
            "اتحاد شباب العمال": {
                folderId: "1x0CxvuWBXnhwFORVUSm-G7T_0Ga0LRzD",
                sheetId: "1oqwe8JBjM_LwQgGlYbPGGU4HMpJw9iIMKiIysK8wwr4"
            },
            "الاتحاد المصري للكيانات الشبابيه": {
                folderId: "1id7aVnhJDQy6Gh8VJEnp0A1-3k4PlYoW",
                sheetId: "1oqwe8JBjM_LwQgGlYbPGGU4HMpJw9iIMKiIysK8wwr4"
            },
            "اتحاد بشبابها": {
                folderId: "1G5HBLB6qKLrdQ5NzhsMEHTdx8RPuPEuq",
                sheetId: "1oqwe8JBjM_LwQgGlYbPGGU4HMpJw9iIMKiIysK8wwr4"
            },
            "اتحاد الوطني للقيادات الشبابيه": {
                folderId: "1vptmKjQTE5dUL_Xvabh8KKYzl9utad2X",
                sheetId: "1oqwe8JBjM_LwQgGlYbPGGU4HMpJw9iIMKiIysK8wwr4"
            },
            "اتحاد شباب تحيا مصر": {
                folderId: "1TeAiIYOdFtZTQc23_YtELUiy0UziTo70",
                sheetId: "1oqwe8JBjM_LwQgGlYbPGGU4HMpJw9iIMKiIysK8wwr4"
            },
            "اتحاد شباب يدير شباب - YLY": {
                folderId: "1jYFcUx32DbQfP1N4X4upvnk-01meh7I4",
                sheetId: "1oqwe8JBjM_LwQgGlYbPGGU4HMpJw9iIMKiIysK8wwr4"
            }
        };

        const defaultFolderId = "1pZzE07caY4J1QULzj_netTfE-HqGxF5Y"; 
        const defaultSheetId = "1oqwe8JBjM_LwQgGlYbPGGU4HMpJw9iIMKiIysK8wwr4";

        const config = entityConfig[entity] || { folderId: defaultFolderId, sheetId: defaultSheetId };

        // إعداد المصادقة
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
            },
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/spreadsheets'
            ],
        });

        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });

        // رفع الصور لكل كيان في الفولدر الخاص بيه
        async function uploadFile(fileObj, prefix) {
            if (!fileObj || !fileObj.base64) return "لا يوجد ملف";
            try {
                const buffer = Buffer.from(fileObj.base64, 'base64');
                const stream = new Readable();
                stream.push(buffer);
                stream.push(null);

                const fileName = `${fullName} - ${prefix} - ${fileObj.name || "file.jpg"}`;

                const response = await drive.files.create({
                    requestBody: {
                        name: fileName,
                        parents: [config.folderId],
                    },
                    media: {
                        mimeType: 'image/jpeg',
                        body: stream,
                    },
                    fields: 'webViewLink',
                });

                return response.data.webViewLink || "تم الرفع";
            } catch (err) {
                console.error("Upload error:", err);
                return "خطأ في الرفع: " + err.message;
            }
        }

        const [fbUrl, cert1Url, cert2Url, cert3Url, cert4Url] = await Promise.all([
            uploadFile(files.fbScreenshot, "سكرين فيس"),
            uploadFile(files.cert1, "شهادة 1"),
            uploadFile(files.cert2, "شهادة 2"),
            uploadFile(files.cert3, "شهادة 3"),
            uploadFile(files.cert4, "شهادة 4")
        ]);

        // ترتيب الصف بنفس ترتيب أعمدة الصورة بالضبط (من A إلى M)
        const rowData = [
            new Date().toLocaleString('ar-EG'), // طابع زمني
            regType,                           // عرفت عن التدريب منين؟
            fullName,                          // الاسم ثلاثي
            friendName,                        // اسم صديقك الثلاثي
            entity,                            // الاتحاد المنضم إليه
            governorate,                       // المحافظة/التيم التابع له
            isFollowingFb,                     // متابع لصفحه الفيسبوك؟
            fbUrl,                             // رابط اسكرين الفيسبوك
            namesOnCertificates,               // الاسم المستخدم في الشهادات
            cert1Url,                          // شهادة 1
            cert2Url,                          // شهادة 2
            cert3Url,                          // شهادة 3
            cert4Url                           // شهادة 4
        ];

        // توجيه البيانات للـ Tab الخاصة بالكيان (مثل: 'اتحاد شباب يدير شباب - YLY')
        const sheetTabName = entity || 'Sheet1';

        await sheets.spreadsheets.values.append({
            spreadsheetId: config.sheetId,
            range: `'${sheetTabName}'!A:M`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [rowData],
            },
        });

        return res.status(200).json({ status: "success" });

    } catch (error) {
        console.error("Handler error:", error);
        return res.status(500).json({ status: "error", message: error.toString() });
    }
}