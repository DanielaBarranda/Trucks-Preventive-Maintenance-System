using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

namespace starqueen.Services
{
    // Stores expense photos outside the public web root, in one folder per organization:
    //   {ContentRoot}/App_Data/uploads/{organizationId}/{guid}.jpg
    // Files are only served through an authorized API endpoint.
    public class UploadStorage
    {
        public static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png" };
        public const long MaxPhotoBytes = 10 * 1024 * 1024; // 10 MB per photo

        private readonly string _root;

        public UploadStorage(IHostEnvironment env) =>
            _root = Path.Combine(env.ContentRootPath, "App_Data", "uploads");

        // Returns an error message, or null when the file is an acceptable JPG/PNG
        public static string? Validate(IFormFile? file, string label)
        {
            if (file == null || file.Length == 0) return $"{label} is required.";
            if (file.Length > MaxPhotoBytes) return $"{label} must be 10 MB or smaller.";

            string ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext)) return $"{label} must be a JPG or PNG image.";

            // Check the file signature, not just the name
            Span<byte> header = stackalloc byte[8];
            using var s = file.OpenReadStream();
            int read = s.Read(header);
            bool isJpeg = read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
            bool isPng = read >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;
            return isJpeg || isPng ? null : $"{label} is not a valid JPG or PNG image.";
        }

        public async Task<string> Save(int organizationId, IFormFile file)
        {
            string folder = Path.Combine(_root, organizationId.ToString());
            Directory.CreateDirectory(folder);
            string fileName = Guid.NewGuid().ToString("N") + Path.GetExtension(file.FileName).ToLowerInvariant();
            using var stream = new FileStream(Path.Combine(folder, fileName), FileMode.CreateNew);
            await file.CopyToAsync(stream);
            return fileName;
        }

        public Stream? OpenRead(int organizationId, string fileName)
        {
            // fileName comes from the database, but never trust it as a path
            if (fileName != Path.GetFileName(fileName)) return null;
            string path = Path.Combine(_root, organizationId.ToString(), fileName);
            return File.Exists(path) ? File.OpenRead(path) : null;
        }

        public void DeleteQuietly(int organizationId, params string?[] fileNames)
        {
            foreach (var name in fileNames.Where(n => !string.IsNullOrEmpty(n)))
                try { File.Delete(Path.Combine(_root, organizationId.ToString(), Path.GetFileName(name!))); } catch { }
        }

        public static string ContentType(string fileName) =>
            Path.GetExtension(fileName).ToLowerInvariant() == ".png" ? "image/png" : "image/jpeg";
    }
}
