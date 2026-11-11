using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class MaintenanceReferenceServices
    {
        public readonly MaintenanceReferenceRepository _repo = new MaintenanceReferenceRepository();

        public Maintenance_Reference GetMaintenanceReferenceById(int id)
        {
            return _repo.GetById(id);
        }

        public bool AddMaintenanceReference(Maintenance_Reference reference)
        {
            return _repo.Add(reference);
        }

        public bool DeleteMaintenanceReference(int id)
        {
            return _repo.Delete(id);
        }

        public List<Maintenance_Reference> GetAllMaintenanceReferences()
        {
            return (List<Maintenance_Reference>)_repo.GetAll();
        }

        public bool UpdateMaintenanceReference(Maintenance_Reference reference)
        {
            return _repo.Update(reference);
        }
    }
}